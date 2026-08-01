import { BadRequestException } from '@nestjs/common';

export class PhoneUtils {
  /**
   * Validate and format phone number
   * Enforces Syrian phone numbers (+963) only
   */
  static validateAndFormat(phoneNumber: string): string {
    if (!phoneNumber) {
      throw new BadRequestException('Phone number is required');
    }

    // Remove all non-digit characters
    let digits = phoneNumber.replace(/\D/g, '');

    // Check if it's a Syrian number
    if (digits.startsWith('963')) {
      // Already in international format for Syria
      if (digits.length === 12) { // 963 + 9 digits
        return `+${digits}`;
      }
    } else if (digits.startsWith('0')) {
      // Local Syrian format (0XXXXXXXXX)
      if (digits.length === 10) {
        return `+963${digits.substring(1)}`;
      }
    } else if (digits.length === 9) {
      // Syrian number without country code or leading zero
      return `+963${digits}`;
    } else if (digits.startsWith('+963')) {
      // Already formatted with + sign
      if (digits.length === 12) {
        return `+${digits.substring(1)}`;
      }
    }

    throw new BadRequestException(
      'Invalid phone number format. Syrian numbers only. Please use: +963XXXXXXXXX, 0XXXXXXXXX, or XXXXXXXXX'
    );
  }

  /**
   * Extract digits only from phone number
   */
  static extractDigits(phoneNumber: string): string {
    return phoneNumber.replace(/\D/g, '');
  }

  /**
   * Format for WhatsApp (with @s.whatsapp.net)
   */
  static formatForWhatsApp(phoneNumber: string): string {
    const digits = this.extractDigits(phoneNumber);
    
    // Ensure it has Syrian country code
    let formatted = digits;
    if (digits.length === 9) {
      formatted = `963${digits}`;
    } else if (digits.startsWith('0') && digits.length === 10) {
      formatted = `963${digits.substring(1)}`;
    }
    
    return `${formatted}@s.whatsapp.net`;
  }

  /**
   * Check if phone number is Syrian
   */
  static isSyrianNumber(phoneNumber: string): boolean {
    const digits = this.extractDigits(phoneNumber);
    return digits.startsWith('963') || 
           (digits.startsWith('0') && digits.length === 10) || 
           digits.length === 9;
  }

  /**
   * Get country code from phone number
   */
  static getCountryCode(phoneNumber: string): string {
    const digits = this.extractDigits(phoneNumber);
    
    if (digits.startsWith('963')) {
      return '963';
    } else if (digits.length >= 10) {
      // Extract first 1-3 digits as country code
      for (let i = 3; i >= 1; i--) {
        const potentialCode = digits.substring(0, i);
        if (this.isValidCountryCode(potentialCode)) {
          return potentialCode;
        }
      }
    }
    
    return '963'; // Default to Syria
  }

  /**
   * Check if country code is valid
   */
  private static isValidCountryCode(code: string): boolean {
    const validCodes = [
      '1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44',
      '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61',
      '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95',
      '98', '211', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226',
      '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239',
      '240', '241', '242', '243', '244', '245', '246', '247', '248', '249', '250', '251', '252',
      '253', '254', '255', '256', '257', '258', '260', '261', '262', '263', '264', '265', '266',
      '267', '268', '269', '290', '291', '297', '298', '299', '350', '351', '352', '353', '354',
      '355', '356', '357', '358', '359', '370', '371', '372', '373', '374', '375', '376', '377',
      '378', '379', '380', '381', '382', '383', '385', '386', '387', '389', '420', '421', '423',
      '500', '501', '502', '503', '504', '505', '506', '507', '508', '509', '590', '591', '592',
      '593', '594', '595', '596', '597', '598', '599', '670', '672', '673', '674', '675', '676',
      '677', '678', '679', '680', '681', '682', '683', '685', '686', '687', '688', '689', '690',
      '691', '692', '850', '852', '853', '855', '856', '880', '886', '960', '961', '962', '963',
      '964', '965', '966', '967', '968', '970', '971', '972', '973', '974', '975', '976', '977',
      '992', '993', '994', '995', '996', '998'
    ];
    
    return validCodes.includes(code);
  }

  /**
   * Reserved seed phones (+96399900XXXX) — never deliver WhatsApp OTP/credentials.
   * Used by tools/dev/seed-demo-clinics.mjs. Pattern alone is enough (no NODE_ENV gate)
   * so Railway/prod seeding cannot accidentally message real WhatsApp numbers.
   */
  static isDevSeedPhone(phoneNumber: string): boolean {
    try {
      const formatted = this.validateAndFormat(phoneNumber);
      return /^\+96399900\d{4}$/.test(formatted);
    } catch {
      return false;
    }
  }

  /** Expose OTP / temp password in API responses for seed phones or local development. */
  static shouldExposeSeedSecrets(phoneNumber: string): boolean {
    return process.env.NODE_ENV === 'development' || this.isDevSeedPhone(phoneNumber);
  }

  /**
   * Mask phone number for display
   */
  static maskPhoneNumber(phoneNumber: string): string {
    const digits = this.extractDigits(phoneNumber);
    
    if (digits.length <= 4) {
      return '****';
    }
    
    const visibleDigits = 4;
    const maskedLength = digits.length - visibleDigits;
    const maskedPart = '*'.repeat(maskedLength);
    const visiblePart = digits.substring(maskedLength);
    
    return maskedPart + visiblePart;
  }
}