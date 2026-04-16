import React from "react";
import type { AwsBaseConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AwsBaseConfig;
  onChange: (patch: Partial<AwsBaseConfig>) => void;
}

export function AwsBaseFields({ config, onChange }: Props): React.ReactElement {
  return (
    <>
      <CredentialSelector
        kinds={["aws"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="AWS Credential"
        placeholder="— Use environment variables —"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Region</Label>
          <Input
            value={config.region ?? ""}
            onChange={(e) => onChange({ region: e.target.value || undefined })}
            placeholder="us-east-1"
          />
        </div>
        <div>
          <Label>Custom Endpoint</Label>
          <Input
            value={config.endpoint ?? ""}
            onChange={(e) => onChange({ endpoint: e.target.value || undefined })}
            placeholder="http://localhost:4566"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">LocalStack / custom</p>
        </div>
      </div>
    </>
  );
}
