"use client";

import { createContext, useContext } from "react";

export type IntegrationStatus = { cloudinary: boolean; resend: boolean };

const IntegrationsContext = createContext<IntegrationStatus>({ cloudinary: false, resend: false });

export function IntegrationsProvider({ value, children }: { value: IntegrationStatus; children: React.ReactNode }) {
  return <IntegrationsContext.Provider value={value}>{children}</IntegrationsContext.Provider>;
}

export function useIntegrations() {
  return useContext(IntegrationsContext);
}
