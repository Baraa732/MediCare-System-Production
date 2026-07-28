import type {
  DoctorType,
  AppointmentType,
} from "@/features/dashboardAssitant/types";
import { resolveAppointmentConflict } from "@/features/dashboardAssitant/utils/conflictResolve";

const dummyDoctors: DoctorType[] = [
  {
    id: "doc-1",
    name: "Dr. Adam",
    avatar: "",
    specialty: "General",
    appointments: [
      {
        id: "apt-1",
        start: 540,
        end: 600,
        docId: "doc-1",
        status: "confirmed",
        title: "Checkup",
        treatmentId: "t1",
        complexity: "standard",
        duration: 60,
        price: 100,
        notes: "",
        date: Date.now(),
        patient: {
          name: "John",
          age: 30,
          phone: "123",
          gender: "Male",
          adddress: "Street 1",
        },
        refuseTransfer: false,
      },
      {
        id: "apt-3",
        start: 615,
        end: 680,
        docId: "doc-1",
        status: "confirmed",
        title: "Follow-up",
        treatmentId: "t2",
        complexity: "standard",
        duration: 65,
        price: 80,
        notes: "",
        date: Date.now(),
        patient: {
          name: "Jane",
          age: 25,
          phone: "456",
          gender: "Female",
          adddress: "Street 2",
        },
        refuseTransfer: false,
      },
    ],
  },
  {
    id: "doc-2",
    name: "Dr. Sarah",
    avatar: "",
    specialty: "Cardiology",
    appointments: [], // completely free
  },
  {
    id: "doc-3",
    name: "Dr. Mike",
    avatar: "",
    specialty: "Dermatology",
    appointments: [
      {
        id: "apt-5",
        start: 600,
        end: 660,
        docId: "doc-3",
        status: "confirmed",
        title: "Skin check",
        treatmentId: "t3",
        complexity: "standard",
        duration: 60,
        price: 120,
        notes: "",
        date: Date.now(),
        patient: {
          name: "Alice",
          age: 40,
          phone: "789",
          gender: "Female",
          adddress: "Street 3",
        },
        refuseTransfer: false,
      },
    ],
  },
];
export function testIntelligenceAlgorithm() {
  // ----- Test Cases -----

  // 1. Shift Down (same doctor, later slot available)
  const existingApt1: AppointmentType = dummyDoctors[0].appointments[0]; // 540-600
  const conflictingApt1: AppointmentType = {
    id: "apt-2",
    docId: "doc-1",
    start: 610,
    end: 620,
    status: "pending",
    title: "New Patient",
    treatmentId: "t4",
    complexity: "standard",
    duration: 60,
    price: 150,
    notes: "",
    date: Date.now(),
    patient: {
      name: "Bob",
      age: 50,
      phone: "111",
      gender: "Male",
      adddress: "Street 4",
    },
    refuseTransfer: true, // must stay with Dr. Adam
  };
  console.log(
    "Test 1 (Shift Down):",
    resolveAppointmentConflict(existingApt1, conflictingApt1, dummyDoctors),
  );

  // 2. Shift Up (same doctor, earlier slot available)
  const existingApt2: AppointmentType = dummyDoctors[0].appointments[1]; // 615-680
  const conflictingApt2: AppointmentType = {
    id: "apt-4",
    docId: "doc-1",
    start: 600,
    end: 630,
    status: "pending",
    title: "Early check",
    treatmentId: "t5",
    complexity: "standard",
    duration: 30,
    price: 90,
    notes: "",
    date: Date.now(),

    patient: {
      name: "Carol",
      age: 35,
      phone: "222",
      gender: "Female",
      adddress: "Street 5",
    },
    refuseTransfer: true,
  };
  console.log(
    "Test 2 (Shift Up):",
    resolveAppointmentConflict(existingApt2, conflictingApt2, dummyDoctors),
  );

  // 3. Transfer to another doctor (refuseTransfer: false, another doctor has free slot)
  const existingApt3: AppointmentType = dummyDoctors[0].appointments[0]; // 540-600
  const conflictingApt3: AppointmentType = {
    id: "apt-6",
    docId: "doc-1",
    start: 550,
    end: 610,
    status: "pending",
    title: "Transfer candidate",
    treatmentId: "t6",
    complexity: "standard",
    duration: 60,
    price: 130,
    notes: "",
    date: Date.now(),

    patient: {
      name: "Dave",
      age: 45,
      phone: "333",
      gender: "Male",
      adddress: "Street 6",
    },
    refuseTransfer: false, // allowed to move to another doctor
  };
  console.log(
    "Test 3 (Transfer to free doctor):",
    resolveAppointmentConflict(existingApt3, conflictingApt3, dummyDoctors),
  );

  // 4. No conflict (fits perfectly)
  const existingApt4: AppointmentType = dummyDoctors[2].appointments[0]; // doc-3, 600-660
  const conflictingApt4: AppointmentType = {
    id: "apt-7",
    docId: "doc-3",
    start: 500,
    end: 540,
    status: "pending",
    title: "Morning slot",
    treatmentId: "t7",
    complexity: "standard",
    duration: 40,
    price: 70,
    notes: "",
    date: Date.now(),

    patient: {
      name: "Eve",
      age: 28,
      phone: "444",
      gender: "Female",
      adddress: "Street 7",
    },
    refuseTransfer: false,
  };
  console.log(
    "Test 4 (No conflict):",
    resolveAppointmentConflict(existingApt4, conflictingApt4, dummyDoctors),
  );
}
