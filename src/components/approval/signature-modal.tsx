"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { toast } from "sonner";
import { Button, Input, Modal } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { getFirebaseAuth } from "@/lib/firebase/config";
import { friendlyError } from "@/lib/utils";
import { recordSignature } from "@/services/documents";
import type { ElectronicSignature } from "@/types";

export function SignatureModal({
  open,
  recordType,
  recordId,
  meaning,
  onClose,
  onSigned,
}: {
  open: boolean;
  recordType: string;
  recordId: string;
  meaning: ElectronicSignature["meaning"];
  onClose: () => void;
  onSigned?: () => void;
}) {
  const { profile, user } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (!profile || !user?.email) return;
    if (!password) {
      toast.error("Re-enter your password to apply this signature.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), user.email, password);
      await recordSignature({
        recordType,
        recordId,
        meaning,
        userId: profile.uid,
        userName: profile.displayName || profile.email,
        userRole: profile.role,
      });
      toast.success(`${meaning} recorded for ${profile.displayName}.`);
      setPassword("");
      onSigned?.();
      onClose();
    } catch (err) {
      toast.error(friendlyError(err, "Signature could not be confirmed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title={meaning}
      description="Electronic approval requires authentication confirmation. This is not a checkbox."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} loading={loading}>
            Sign
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        {profile?.displayName} ({profile?.role}) signing as {meaning} on {recordType} {recordId}.
      </p>
      <Input
        label="Confirm password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
    </Modal>
  );
}
