import type { ActivationContext } from "@/stores/authStore";

export function parseAdminFullName(fullName: string): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", middleName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: parts[0] };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], middleName: "", lastName: parts[1] };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

/** Parse OpenStreetMap / Nominatim clinic pin address into contact fields. */
export function parseClinicMapAddress(address?: string): {
  governorate?: string;
  state?: string;
  streetInfo?: string;
} {
  if (!address?.trim()) return {};

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const governoratePart = parts.find((part) => /governorate/i.test(part));
  const governorate = governoratePart
    ?.replace(/\s*governorate\s*/gi, "")
    .trim();

  const areaPart =
    parts.find((part) => /municipality/i.test(part)) ??
    parts.find((part) => /neighborhood/i.test(part)) ??
    parts.find(
      (part) => /district/i.test(part) && !/subdistrict/i.test(part),
    );

  const state = areaPart
    ?.replace(/\s*(municipality|neighborhood|district|subdistrict)\s*/gi, "")
    .trim();

  return {
    governorate: governorate || undefined,
    state: state || undefined,
    streetInfo: address.trim(),
  };
}

export function activationContextFromStatus(status: {
  adminFullName?: string;
  clinicLocation?: string;
  idNumber?: string;
  dateOfBirth?: string;
  email?: string;
  registrationLicenseNumber?: string;
  address?: string;
  phoneNumber?: string;
}): ActivationContext | undefined {
  if (
    !status.adminFullName &&
    !status.clinicLocation &&
    !status.idNumber &&
    !status.dateOfBirth &&
    !status.phoneNumber
  ) {
    return undefined;
  }
  return {
    adminFullName: status.adminFullName,
    clinicLocation: status.clinicLocation,
    idNumber: status.idNumber,
    dateOfBirth: status.dateOfBirth,
    email: status.email,
    registrationLicenseNumber: status.registrationLicenseNumber,
    address: status.address,
    phoneNumber: status.phoneNumber,
  };
}

interface ActivationFormWriter {
  setValue: (
    name: string,
    value: string,
    options?: { shouldValidate?: boolean },
  ) => void;
  getValues: (name: string) => unknown;
}

export function applyActivationProfileToForm(
  form: ActivationFormWriter,
  context: ActivationContext | null,
  phoneNumber?: string,
) {
  if (phoneNumber) {
    form.setValue("phoneNumber", phoneNumber, { shouldValidate: true });
  }

  if (!context) return;

  if (context.adminFullName) {
    const { firstName, middleName, lastName } = parseAdminFullName(
      context.adminFullName,
    );
    form.setValue("firstName", firstName, { shouldValidate: true });
    form.setValue("middleName", middleName);
    form.setValue("lastName", lastName, { shouldValidate: true });
  }

  if (context.idNumber) {
    form.setValue("nationalId", context.idNumber, { shouldValidate: true });
  }

  if (context.dateOfBirth) {
    form.setValue("birthDate", context.dateOfBirth, { shouldValidate: true });
  }

  if (context.email) {
    form.setValue("email", context.email, { shouldValidate: true });
  }

  if (context.registrationLicenseNumber) {
    form.setValue("licenseNumber", context.registrationLicenseNumber, {
      shouldValidate: true,
    });
  }

  if (context.address) {
    const parsed = parseClinicMapAddress(context.address);
    if (parsed.governorate) {
      form.setValue("governorate", parsed.governorate, { shouldValidate: true });
    }
    if (parsed.state) {
      form.setValue("state", parsed.state);
    }
    if (parsed.streetInfo) {
      form.setValue("streetInfo", parsed.streetInfo);
    }

    const birthPlace = String(form.getValues("birthPlace") ?? "").trim();
    if (birthPlace && birthPlace === context.address.trim()) {
      form.setValue("birthPlace", "", { shouldValidate: false });
    }
  }

  if (context.phoneNumber && !phoneNumber) {
    form.setValue("phoneNumber", context.phoneNumber, { shouldValidate: true });
  }
}

export function activationFieldLocks(context: ActivationContext | null) {
  return {
    name: Boolean(context?.adminFullName),
    birthDate: Boolean(context?.dateOfBirth),
    nationalId: Boolean(context?.idNumber),
    phone: Boolean(context?.phoneNumber),
    email: Boolean(context?.email),
    license: Boolean(context?.registrationLicenseNumber),
    clinicAddress: Boolean(context?.address),
  };
}
