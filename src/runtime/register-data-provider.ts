const getGlobalProviders = () => {
  if (typeof window === "undefined") return {};
  if (!(window as any)._chaiDataProviders) {
    (window as any)._chaiDataProviders = {};
  }
  return (window as any)._chaiDataProviders;
};

export const registerChaiDataProvider = (key: string, provider: any) => {
  const providers = getGlobalProviders();
  providers[key] = provider;
};

export const getChaiDataProviders = () => getGlobalProviders();
