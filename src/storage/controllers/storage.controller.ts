import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { ResponseService } from '../../common/responses/response.service';
import type { AuthenticatedUser } from '../../types';
import {
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  STORAGE_FOLDERS,
  type StorageFolder,
} from '../storage.constants';
import { StorageService } from '../services/storage.service';

@ApiTags('Storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly responseService: ResponseService,
  ) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'folder', enum: STORAGE_FOLDERS, required: true })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('folder') folder: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    if (!STORAGE_FOLDERS.includes(folder as StorageFolder)) {
      throw new BadRequestException(
        `folder must be one of: ${STORAGE_FOLDERS.join(', ')}`,
      );
    }
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    const result = await this.storageService.uploadImage({
      folder: folder as StorageFolder,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      userId: user.userId,
      companyId: user.companyId,
    });

    return this.responseService.success('Image uploaded successfully', result);
  }
}
