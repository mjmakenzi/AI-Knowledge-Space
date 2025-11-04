import { IsString, IsNotEmpty, IsNumberString } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  mime!: string;

  @IsNumberString()
  bytes!: string;

  @IsString()
  @IsNotEmpty()
  storageKey!: string;
}
