import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LicenseKeyStatus } from '../../common/enums';
import { normalizeEmail } from '../../common/utils/contact.util';
import { normalizeLicenseKey } from '../../common/utils/license-key.util';
import { Company, CompanyDocument } from '../../companies/schemas/company.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  LicenseValidationFailure,
  licenseValidationMessage,
} from '../constants/license-validation.messages';
import { License, LicenseDocument } from '../schemas/license.schema';

/** How the license key is being validated */
export type LicenseValidationPurpose = 'registration' | 'activation';

export interface LicenseValidationResult {
  valid: boolean;
  failure?: LicenseValidationFailure;
  message?: string;
  license?: LicenseDocument;
}

export interface ValidateLicenseOptions {
  purpose: LicenseValidationPurpose;
  /** Required for activation — company verifying its assigned key */
  companyId?: string;
  /** When set, also assert company email is not already registered */
  companyEmail?: string;
  /**
   * When true (default for registration), UNUSED is required.
   * Activation allows ACTIVE keys bound to the same company.
   */
  requireUnused?: boolean;
}

/**
 * Reusable license validation service.
 * Runs discrete checks with meaningful failure messages for every case.
 */
@Injectable()
export class LicenseValidationService {
  constructor(
    @InjectModel(License.name)
    private readonly licenseModel: Model<LicenseDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  // ─── Message helpers ───────────────────────────────────────────────────────

  message(failure: LicenseValidationFailure): string {
    return licenseValidationMessage(failure);
  }

  fail(
    failure: LicenseValidationFailure,
    asConflict = false,
  ): never {
    const message = this.message(failure);
    if (asConflict || failure === LicenseValidationFailure.EMAIL_DUPLICATE) {
      throw new ConflictException(message);
    }
    throw new BadRequestException(message);
  }

  // ─── Discrete checks (reusable) ────────────────────────────────────────────

  /** License Exists */
  assertLicenseExists(
    license: LicenseDocument | null | undefined,
  ): asserts license is LicenseDocument {
    if (!license) {
      this.fail(LicenseValidationFailure.NOT_FOUND);
    }
  }

  /**
   * License Active — usable lifecycle state.
   * Registration: must be UNUSED (available to claim).
   * Activation: ACTIVE (bound) or UNUSED (not yet marked).
   */
  assertLicenseActive(
    license: LicenseDocument,
    purpose: LicenseValidationPurpose,
  ): void {
    if (purpose === 'registration') {
      if (license.status !== LicenseKeyStatus.UNUSED) {
        this.fail(LicenseValidationFailure.NOT_ACTIVE);
      }
      return;
    }

    if (
      license.status !== LicenseKeyStatus.ACTIVE &&
      license.status !== LicenseKeyStatus.UNUSED
    ) {
      this.fail(LicenseValidationFailure.NOT_ACTIVE);
    }
  }

  /** License Not Expired */
  assertLicenseNotExpired(license: LicenseDocument): void {
    if (license.status === LicenseKeyStatus.EXPIRED) {
      this.fail(LicenseValidationFailure.EXPIRED);
    }
    if (license.validUntil < new Date()) {
      this.fail(LicenseValidationFailure.EXPIRED);
    }
  }

  /** License Not Revoked (respects optional revoke grace window for preview) */
  assertLicenseNotRevoked(
    license: LicenseDocument,
    options?: { allowWithinRevokeGrace?: boolean },
  ): void {
    if (license.status !== LicenseKeyStatus.REVOKED) {
      return;
    }

    if (
      options?.allowWithinRevokeGrace &&
      license.revokedAt &&
      license.revokeGracePeriodHours
    ) {
      const graceEnd = new Date(license.revokedAt);
      graceEnd.setHours(
        graceEnd.getHours() + license.revokeGracePeriodHours,
      );
      if (new Date() <= graceEnd) {
        return;
      }
      this.fail(LicenseValidationFailure.REVOKED_GRACE_ENDED);
    }

    this.fail(LicenseValidationFailure.REVOKED);
  }

  /** License Not Cancelled */
  assertLicenseNotCancelled(license: LicenseDocument): void {
    if (license.status === LicenseKeyStatus.CANCELLED) {
      this.fail(LicenseValidationFailure.CANCELLED);
    }
  }

  /**
   * License Not Already Used
   * - Registration: must be UNUSED and not linked to a company
   * - Activation: may be used by *this* company only
   */
  assertLicenseNotAlreadyUsed(
    license: LicenseDocument,
    options: {
      purpose: LicenseValidationPurpose;
      companyId?: string;
      companyLicenseId?: string;
    },
  ): void {
    const licenseCompanyId = license.companyId?.toString();
    const { purpose, companyId, companyLicenseId } = options;

    if (purpose === 'registration') {
      if (
        license.status !== LicenseKeyStatus.UNUSED ||
        licenseCompanyId ||
        license.usedAt
      ) {
        this.fail(LicenseValidationFailure.ALREADY_USED);
      }
      return;
    }

    // Activation
    if (licenseCompanyId && companyId && licenseCompanyId !== companyId) {
      this.fail(LicenseValidationFailure.ALREADY_USED_BY_OTHER);
    }

    if (
      companyLicenseId &&
      license._id.toString() !== companyLicenseId &&
      !licenseCompanyId
    ) {
      this.fail(LicenseValidationFailure.ALREADY_USED_BY_OTHER);
    }

    if (companyLicenseId && license._id.toString() !== companyLicenseId) {
      this.fail(LicenseValidationFailure.KEY_MISMATCH);
    }

    // Key already consumed by another company without matching companyId check above
    if (
      license.status !== LicenseKeyStatus.UNUSED &&
      license.status !== LicenseKeyStatus.ACTIVE
    ) {
      this.fail(LicenseValidationFailure.ALREADY_USED);
    }
  }

  /**
   * Company Email Not Duplicate — companies + users.
   * Does not check license contact emails (those are expected to match
   * the company that will register with an unused key).
   */
  async assertCompanyEmailNotDuplicate(
    email: string,
    excludeCompanyId?: string,
  ): Promise<void> {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return;
    }

    const companyFilter: Record<string, unknown> = {
      email: normalized,
    };
    if (excludeCompanyId) {
      companyFilter._id = { $ne: excludeCompanyId };
    }

    const existingCompany = await this.companyModel.findOne(companyFilter);
    if (existingCompany) {
      this.fail(LicenseValidationFailure.EMAIL_DUPLICATE, true);
    }

    const existingUser = await this.userModel.findOne({
      email: normalized,
    });
    if (existingUser) {
      const sameCompany =
        excludeCompanyId &&
        existingUser.companyId?.toString() === excludeCompanyId;
      if (!sameCompany) {
        this.fail(LicenseValidationFailure.EMAIL_DUPLICATE, true);
      }
    }
  }

  /**
   * Email uniqueness for Super Admin license creation:
   * companies + users + non-cancelled license contacts.
   */
  async assertLicenseContactEmailUnique(email: string): Promise<void> {
    await this.assertCompanyEmailNotDuplicate(email);

    const normalized = normalizeEmail(email);
    if (!normalized) {
      return;
    }

    const existingLicenseContact = await this.licenseModel.findOne({
      contactEmail: normalized,
      status: { $ne: LicenseKeyStatus.CANCELLED },
    });
    if (existingLicenseContact) {
      this.fail(LicenseValidationFailure.EMAIL_DUPLICATE, true);
    }
  }

  // ─── Soft (non-throwing) checks for public preview ─────────────────────────

  private softFail(
    failure: LicenseValidationFailure,
  ): LicenseValidationResult {
    return {
      valid: false,
      failure,
      message: this.message(failure),
    };
  }

  evaluateLicense(
    license: LicenseDocument | null,
    options: ValidateLicenseOptions,
  ): LicenseValidationResult {
    if (!license) {
      return this.softFail(LicenseValidationFailure.NOT_FOUND);
    }

    if (license.status === LicenseKeyStatus.CANCELLED) {
      return this.softFail(LicenseValidationFailure.CANCELLED);
    }

    if (license.status === LicenseKeyStatus.REVOKED) {
      if (license.revokedAt && license.revokeGracePeriodHours) {
        const graceEnd = new Date(license.revokedAt);
        graceEnd.setHours(
          graceEnd.getHours() + license.revokeGracePeriodHours,
        );
        if (new Date() > graceEnd) {
          return this.softFail(LicenseValidationFailure.REVOKED_GRACE_ENDED);
        }
      }
      // For registration/activation preview, revoked is always invalid
      if (options.purpose !== 'activation') {
        return this.softFail(LicenseValidationFailure.REVOKED);
      }
      return this.softFail(LicenseValidationFailure.REVOKED);
    }

    if (license.status === LicenseKeyStatus.EXPIRED) {
      return this.softFail(LicenseValidationFailure.EXPIRED);
    }

    if (license.validUntil < new Date()) {
      return this.softFail(LicenseValidationFailure.EXPIRED);
    }

    if (options.purpose === 'registration') {
      if (
        license.status !== LicenseKeyStatus.UNUSED ||
        license.companyId ||
        license.usedAt
      ) {
        return this.softFail(LicenseValidationFailure.ALREADY_USED);
      }
    }

    // Active check (usable state)
    if (options.purpose === 'registration') {
      if (license.status !== LicenseKeyStatus.UNUSED) {
        return this.softFail(LicenseValidationFailure.NOT_ACTIVE);
      }
    } else if (
      license.status !== LicenseKeyStatus.ACTIVE &&
      license.status !== LicenseKeyStatus.UNUSED
    ) {
      return this.softFail(LicenseValidationFailure.NOT_ACTIVE);
    }

    return { valid: true, license };
  }

  // ─── Composite validators ──────────────────────────────────────────────────

  async findByKey(licenseKey: string): Promise<LicenseDocument | null> {
    const key = normalizeLicenseKey(licenseKey);
    if (!key) {
      return null;
    }
    return this.licenseModel.findOne({ licenseKey: key });
  }

  /**
   * Non-throwing validation (public GET /licenses/validate).
   * Order: Exists → Cancelled → Revoked → Expired → Already Used → Active
   */
  async validateKeyPreview(
    licenseKey: string,
  ): Promise<LicenseValidationResult> {
    if (!licenseKey?.trim()) {
      return this.softFail(LicenseValidationFailure.KEY_REQUIRED);
    }
    const license = await this.findByKey(licenseKey);
    return this.evaluateLicense(license, { purpose: 'registration' });
  }

  /**
   * Throws on any failure. Used by registration and activation.
   * Runs all required checks with meaningful messages.
   */
  async validateOrThrow(
    licenseKey: string,
    options: ValidateLicenseOptions,
  ): Promise<LicenseDocument> {
    if (!licenseKey?.trim()) {
      this.fail(LicenseValidationFailure.KEY_REQUIRED);
    }

    const license = await this.findByKey(licenseKey);
    this.assertLicenseExists(license);

    this.assertLicenseNotCancelled(license);
    this.assertLicenseNotRevoked(license);
    this.assertLicenseNotExpired(license);

    let companyLicenseId: string | undefined;
    if (options.purpose === 'activation' && options.companyId) {
      const company = await this.companyModel
        .findById(options.companyId)
        .select('licenseId');
      companyLicenseId = company?.licenseId?.toString();
    }

    this.assertLicenseNotAlreadyUsed(license, {
      purpose: options.purpose,
      companyId: options.companyId,
      companyLicenseId,
    });

    this.assertLicenseActive(license, options.purpose);

    if (options.companyEmail) {
      await this.assertCompanyEmailNotDuplicate(options.companyEmail);
    }

    return license;
  }

  /**
   * Registration shortcut: key usable + optional email uniqueness.
   */
  async validateForRegistration(
    licenseKey: string,
    companyEmail?: string,
  ): Promise<LicenseDocument> {
    return this.validateOrThrow(licenseKey, {
      purpose: 'registration',
      companyEmail,
    });
  }

  /**
   * Post-login activation shortcut.
   */
  async validateForActivation(
    licenseKey: string,
    companyId: string,
  ): Promise<LicenseDocument> {
    return this.validateOrThrow(licenseKey, {
      purpose: 'activation',
      companyId,
    });
  }
}
