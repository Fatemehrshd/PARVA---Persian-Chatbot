/**
 * Centralized Persian error messages for class-validator decorators.
 * One place to update wording; imported by every DTO.
 *
 * Every request body field is validated against at least one of these.
 * Adding a new constraint = add a new constant here and reference it from
 * the decorator on the DTO.
 */
export const FA = {
  // ---- shared ----
  required: (field: string) => `${field} الزامی است`,
  string: (field: string) => `${field} باید متن باشد`,
  boolean: (field: string) => `${field} باید true یا false باشد`,
  uuid: (field: string) => `${field} باید یک شناسه معتبر باشد`,

  // ---- auth ----
  emailInvalid: 'ایمیل نامعتبر است',
  emailRequired: 'ایمیل الزامی است',
  passwordMin: 'رمز عبور باید حداقل ۸ کاراکتر باشد',
  passwordRequired: 'رمز عبور الزامی است',
  passwordComplexity: 'رمز عبور باید حداقل ۸ کاراکتر و شامل حروف بزرگ، کوچک، عدد و نماد باشد',
  displayNameString: 'نام نمایشی باید متن باشد',
  invalidCredentials: 'ایمیل یا رمز عبور اشتباه است',
  refreshTokenRequired: 'ارائه رفرش توکن الزامی است',
  refreshTokenInvalid: 'نشست نامعتبر یا منقضی شده است',

  // ---- chat ----
  contentMin: 'پیام نمی‌تواند خالی باشد',
  contentString: 'محتوای پیام باید متن باشد',
  conversationIdUuid: 'شناسه گفتگو باید یک UUID معتبر باشد',
  modelIdUuid: 'شناسه مدل باید یک UUID معتبر باشد',
  titleString: 'عنوان گفتگو باید متن باشد',

  // ---- uploads ----
  fileTooLarge: 'حجم فایل بیش از حد مجاز است (حداکثر ۲ مگابایت)',

  // ---- admin models ----
  nameRequired: 'نام مدل الزامی است',
  nameString: 'نام مدل باید متن باشد',
  providerRequired: 'ارائه‌دهنده مدل الزامی است',
  providerString: 'ارائه‌دهنده مدل باید متن باشد',
  apiIdentifierRequired: 'شناسه API مدل الزامی است',
  apiIdentifierString: 'شناسه API مدل باید متن باشد',
  modelIdParamUuid: 'شناسه مدل در URL باید یک UUID معتبر باشد',

  // ---- model access ----
  modelAccessDenied: 'به این مدل دسترسی ندارید',
};
