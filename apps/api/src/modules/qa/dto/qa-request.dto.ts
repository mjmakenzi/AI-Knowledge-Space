import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QARequestDto {
  @IsString()
  question!: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  k?: number;
}
