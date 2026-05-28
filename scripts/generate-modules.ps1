$base = "c:\Users\Akhil\OneDrive\Desktop\IntefaiIT\Fleet Track\Fleet-backend\src"

$modules = @{
  auth = @{ singular = "Auth"; route = "auth"; tag = "Auth" }
  companies = @{ singular = "Company"; route = "companies"; tag = "Companies" }
  licenses = @{ singular = "License"; route = "licenses"; tag = "Licenses" }
  subscriptions = @{ singular = "Subscription"; route = "subscriptions"; tag = "Subscriptions" }
  users = @{ singular = "User"; route = "users"; tag = "Users" }
  vehicles = @{ singular = "Vehicle"; route = "vehicles"; tag = "Vehicles" }
  drivers = @{ singular = "Driver"; route = "drivers"; tag = "Drivers" }
  expenses = @{ singular = "Expense"; route = "expenses"; tag = "Expenses" }
  reports = @{ singular = "Report"; route = "reports"; tag = "Reports" }
  analytics = @{ singular = "Analytics"; route = "analytics"; tag = "Analytics" }
  notifications = @{ singular = "Notification"; route = "notifications"; tag = "Notifications" }
  payments = @{ singular = "Payment"; route = "payments"; tag = "Payments" }
  settings = @{ singular = "Setting"; route = "settings"; tag = "Settings" }
}

foreach ($name in $modules.Keys) {
  $info = $modules[$name]
  $singular = $info.singular
  $route = $info.route
  $tag = $info.tag
  $modulePath = Join-Path $base $name
  $schemaFile = "$($singular.ToLower()).schema.ts"
  $createDto = "create-$($singular.ToLower()).dto.ts"
  $updateDto = "update-$($singular.ToLower()).dto.ts"

  @"
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ${singular}Document = ${singular} & Document;

@Schema({ timestamps: true })
export class ${singular} {
  @Prop({ type: Types.ObjectId, ref: 'Company', index: true })
  companyId?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const ${singular}Schema = SchemaFactory.createForClass(${singular});
"@ | Set-Content -Path (Join-Path $modulePath "schemas\$schemaFile") -Encoding UTF8

  @"
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { Create${singular}Dto } from './$createDto';

export class Update${singular}Dto extends PartialType(Create${singular}Dto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
"@ | Set-Content -Path (Join-Path $modulePath "dto\$updateDto") -Encoding UTF8

  @"
import { IsBoolean, IsOptional } from 'class-validator';

export class Create${singular}Dto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
"@ | Set-Content -Path (Join-Path $modulePath "dto\$createDto") -Encoding UTF8

  @"
export * from './$createDto';
export * from './$updateDto';
"@ | Set-Content -Path (Join-Path $modulePath "dto\index.ts") -Encoding UTF8

  @"
import { ${singular}Document } from '../schemas/$schemaFile';

export interface I${singular}Service {
  findAll(companyId?: string): Promise<${singular}Document[]>;
  findOne(id: string): Promise<${singular}Document | null>;
}
"@ | Set-Content -Path (Join-Path $modulePath "interfaces\$($singular.ToLower()).service.interface.ts") -Encoding UTF8

  @"
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseService } from '../../common/responses/response.service';
import { ${singular}, ${singular}Document } from '../schemas/$schemaFile';
import { Create${singular}Dto } from '../dto/$createDto';
import { Update${singular}Dto } from '../dto/$updateDto';

@Injectable()
export class ${singular}sService {
  constructor(
    @InjectModel(${singular}.name)
    private readonly ${singular.ToLower()}Model: Model<${singular}Document>,
    private readonly responseService: ResponseService,
  ) {}

  async create(dto: Create${singular}Dto, companyId?: string) {
    const created = await this.${singular.ToLower()}Model.create({
      ...dto,
      ...(companyId ? { companyId } : {}),
    });
    return this.responseService.created('${singular} created successfully', created);
  }

  async findAll(companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const items = await this.${singular.ToLower()}Model.find(filter).sort({ createdAt: -1 });
    return this.responseService.success('${tag} fetched successfully', items);
  }

  async findOne(id: string) {
    const item = await this.${singular.ToLower()}Model.findById(id);
    if (!item) {
      throw new NotFoundException('${singular} not found');
    }
    return this.responseService.success('${singular} fetched successfully', item);
  }

  async update(id: string, dto: Update${singular}Dto) {
    const item = await this.${singular.ToLower()}Model.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!item) {
      throw new NotFoundException('${singular} not found');
    }
    return this.responseService.success('${singular} updated successfully', item);
  }

  async remove(id: string) {
    const item = await this.${singular.ToLower()}Model.findByIdAndDelete(id);
    if (!item) {
      throw new NotFoundException('${singular} not found');
    }
    return this.responseService.success('${singular} deleted successfully');
  }
}
"@ | Set-Content -Path (Join-Path $modulePath "services\$($name).service.ts") -Encoding UTF8

  @"
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { ROLES } from '../../constants';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../types';
import { ${singular}sService } from '../services/$name.service';
import { Create${singular}Dto } from '../dto/$createDto';
import { Update${singular}Dto } from '../dto/$updateDto';

@ApiTags('$tag')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('$route')
export class ${singular}sController {
  constructor(private readonly ${singular.ToLower()}sService: ${singular}sService) {}

  @Post()
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.FLEET_MANAGER)
  create(@Body() dto: Create${singular}Dto, @CurrentUser() user: AuthenticatedUser) {
    return this.${singular.ToLower()}sService.create(dto, user.companyId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.${singular.ToLower()}sService.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.${singular.ToLower()}sService.findOne(id);
  }

  @Patch(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.FLEET_MANAGER)
  update(@Param('id') id: string, @Body() dto: Update${singular}Dto) {
    return this.${singular.ToLower()}sService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  remove(@Param('id') id: string) {
    return this.${singular.ToLower()}sService.remove(id);
  }
}
"@ | Set-Content -Path (Join-Path $modulePath "controllers\$($name).controller.ts") -Encoding UTF8

  @"
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${singular}, ${singular}Schema } from './schemas/$schemaFile';
import { ${singular}sController } from './controllers/$name.controller';
import { ${singular}sService } from './services/$name.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ${singular}.name, schema: ${singular}Schema }]),
  ],
  controllers: [${singular}sController],
  providers: [${singular}sService],
  exports: [${singular}sService],
})
export class ${singular}sModule {}
"@ | Set-Content -Path (Join-Path $modulePath "$name.module.ts") -Encoding UTF8
}

Write-Host "Generated $($modules.Count) feature modules"
