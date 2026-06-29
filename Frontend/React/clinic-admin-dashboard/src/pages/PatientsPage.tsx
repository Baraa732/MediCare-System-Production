import { useState } from "react";
import { Search } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { lookupPatientByPhone } from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PatientLookup } from "@/lib/api/users";

export function PatientsPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [phoneNumber, setPhoneNumber] = useState("");
  const [patient, setPatient] = useState<PatientLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPatient(null);
    try {
      const result = await lookupPatientByPhone(phoneNumber.trim(), token);
      setPatient(result);
    } catch (err) {
      setError(normalizeCaughtError(err, "No patient found with this phone number"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Patients</h1>
        <p className="text-neutral-500 mt-1">Look up registered patients by phone number</p>
      </div>

      <Card className="ring-neutral-200 max-w-xl">
        <CardHeader><CardTitle>Patient lookup</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSearch(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="09xxxxxxxx" required />
            </div>
            <Button type="submit" disabled={loading} className="bg-[#0066ff] hover:bg-[#0052cc] rounded-xl">
              <Search className="w-4 h-4 mr-2" />
              {loading ? "Searching…" : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-red-600">{error}</p>}

      {patient && (
        <Card className="ring-neutral-200 max-w-xl">
          <CardHeader><CardTitle>Patient details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-neutral-500">Name:</span> <span className="font-semibold">{patient.fullName ?? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim()}</span></div>
            <div><span className="text-neutral-500">Phone:</span> <span className="font-semibold">{patient.phoneNumber}</span></div>
            <div><span className="text-neutral-500">Status:</span> <span className="font-semibold">{patient.status}</span></div>
            <div><span className="text-neutral-500">Patient ID:</span> <span className="font-mono text-xs">{patient.id}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
