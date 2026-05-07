import { createContext, useContext } from "react";

export type RepeaterItemContextValue = {
  item: Record<string, any>;
  index: number;
  items: Record<string, any>[];
  collectionSlug?: string;
};

export const RepeaterItemContext = createContext<RepeaterItemContextValue>({
  item: {},
  index: 0,
  items: [],
  collectionSlug: "",
});

/** Returns the current row data when a block is rendered inside a Repeater. */
export const useRepeaterItem = (): RepeaterItemContextValue => useContext(RepeaterItemContext);
