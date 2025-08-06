/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('classify')
  @UseInterceptors(FileInterceptor('file'))
  classifyImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadsService.classifyImage(file);
  }
}
