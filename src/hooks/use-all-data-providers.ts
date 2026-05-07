import { useMemo, useState, useEffect } from "react";
import { getChaiDataProviders } from "../runtime/register-data-provider";

export const useAllDataProviders = () => {
  const [providers, setProviders] = useState(getChaiDataProviders());

  useEffect(() => {
    // Poll for changes or just update once on mount to be safe
    setProviders(getChaiDataProviders());
    
    // If we want to be fancy, we could add a custom event listener here
    // for when a new provider is registered.
  }, []);

  return useMemo(() => Object.entries(providers).map(([key, value]) => ({ key, ...(value as any) })), [providers]);
};
