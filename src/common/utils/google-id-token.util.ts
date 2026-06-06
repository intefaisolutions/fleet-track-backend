import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { normalizeEmail } from './contact.util';

export type GoogleIdTokenProfile = {
  email: string;
  name?: string;
};

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string | undefined,
): Promise<GoogleIdTokenProfile> {
  if (!clientId) {
    throw new BadRequestException(
      'Google sign-in is not configured on the server (GOOGLE_CLIENT_ID)',
    );
  }

  const tokenRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!tokenRes.ok) {
    throw new UnauthorizedException('Invalid Google token');
  }

  const payload = (await tokenRes.json()) as {
    aud?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
  };

  if (payload.aud !== clientId) {
    throw new UnauthorizedException('Google token audience mismatch');
  }

  const verified =
    payload.email_verified === true || payload.email_verified === 'true';
  if (!verified || !payload.email) {
    throw new UnauthorizedException('Google email is not verified');
  }

  return {
    email: normalizeEmail(payload.email),
    name: payload.name,
  };
}
