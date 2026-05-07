import { useMemo, useState, useEffect } from "react";
import { getChaiDataProviders } from "../runtime/register-data-provider";

export const useAllDataProviders = () => {
  const [providers, setProviders] = useState(getChaiDataProviders());

  useEffect(() => {
    const handleUpdate = () => {
      setProviders({ ...getChaiDataProviders() });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("chai-data-provider-registered", handleUpdate);
    }
    
    handleUpdate();

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("chai-data-provider-registered", handleUpdate);
      }
    };
  }, []);

  return useMemo(() => Object.entries(providers).map(([key, value]) => ({ key, ...(value as any) })), [providers]);
};
