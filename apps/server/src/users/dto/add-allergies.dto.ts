import { IsArray, IsString, ArrayMaxSize, MaxLength } from 'class-validator';

/** Additive allergy declaration (conversational-allergy §3 confirm-then-write). Canonical chip tokens only. */
export class AddAllergiesDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  allergies!: string[];
}
