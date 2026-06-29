import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { PhoneUtils } from '../../common/utils/phone.utils';

export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidPhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }

          try {
            // Try to validate and format the phone number
            PhoneUtils.validateAndFormat(value);
            return true;
          } catch (error) {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return 'Phone number must be in a valid format. Syrian numbers only. Examples: +963912345678, 0912345678, 912345678';
        },
      },
    });
  };
}

export function IsSyrianPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isSyrianPhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }

          return PhoneUtils.isSyrianNumber(value);
        },
        defaultMessage(args: ValidationArguments) {
          return 'Phone number must be a valid Syrian number. Examples: +963912345678, 0912345678, 912345678';
        },
      },
    });
  };
}