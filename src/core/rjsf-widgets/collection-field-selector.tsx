import { ChevronRightIcon, Cross1Icon } from "@radix-ui/react-icons";
import { t } from "i18next";
import { get } from "lodash-es";
import React, { useMemo, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useBuilderProp } from "~/hooks/use-builder-prop";
import { useSelectedBlockHierarchy } from "~/hooks/use-selected-blockIds";

const isRepeaterBlock = (block: any) =>
  ["repeater", "repeaterGrid", "repeaterList"].includes(block?._type || block?.type);

type FieldDef = { name: string; label?: string; type: string; targetCollection?: string };
type CollectionMeta = { id: string; name: string; slug?: string; fields?: FieldDef[] };


type FieldPickerProps = {
  fields: FieldDef[];
  collections: CollectionMeta[];
  onSelect: (path: string) => void;
};

function FieldPicker({ fields, collections, onSelect }: FieldPickerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const directFields = fields.filter((f) => f.type !== "relation");
  const relationFields = fields.filter((f) => f.type === "relation");

  const rowCls =
    "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground";

  return (
    <Command>
      <CommandInput placeholder={t("Search fields...")} className="border-none" />
      <CommandList className="max-h-60">
        <CommandEmpty>{t("No fields found.")}</CommandEmpty>
        {directFields.length > 0 && (
          <CommandGroup heading={t("Fields")}>
            {directFields.map((f) => (
              <CommandItem key={f.name} value={f.name} onSelect={() => onSelect(f.name)} className={rowCls}>
                <span className="flex-1">{f.label ?? f.name}</span>
                <span className="text-[9px] text-muted-foreground">{f.type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {relationFields.length > 0 && (
          <CommandGroup heading={t("Relations")}>
            {relationFields.map((f) => {
              const related = f.targetCollection
                ? collections.find((c) => c.slug === f.targetCollection || c.id === f.targetCollection)
                : null;
              const subFields = related?.fields?.filter((sf) => sf.type !== "relation") ?? [];
              const isOpen = expanded === f.name;
              return (
                <React.Fragment key={f.name}>
                  <CommandItem
                    value={f.name}
                    onSelect={() => setExpanded(isOpen ? null : f.name)}
                    className={rowCls}>
                    <span className="flex-1">{f.label ?? f.name}</span>
                    <ChevronRightIcon
                      className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </CommandItem>
                  {isOpen &&
                    subFields.map((sf) => (
                      <CommandItem
                        key={`${f.name}.${sf.name}`}
                        value={`${f.name}.${sf.name}`}
                        onSelect={() => onSelect(`${f.name}.${sf.name}`)}
                        className="pl-6 text-xs hover:bg-accent hover:text-accent-foreground">
                        <span className="flex-1">{sf.label ?? sf.name}</span>
                        <span className="text-[9px] text-muted-foreground">{sf.type}</span>
                      </CommandItem>
                    ))}
                </React.Fragment>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

/**
 * RJSF widget for `ui:widget: "nestedPathSelector"`.
 * Stores a plain field-path string (e.g. "title", "author.name").
 * Designed for blocks that live inside a Repeater and want to bind a prop to a collection field.
 */
export function CollectionFieldSelectorWidget({ value, onChange, schema }: any) {
  const [open, setOpen] = useState(false);

  const allCollections = useBuilderProp("collections", []) as CollectionMeta[];
  const hierarchy = useSelectedBlockHierarchy();
  const repeaterBlock = useMemo(() => hierarchy.find((b) => isRepeaterBlock(b)), [hierarchy]);
  const collectionSlug = useMemo(() => get(repeaterBlock, "collectionSlug", ""), [repeaterBlock]);
  const collection = allCollections.find((c) => c.slug === collectionSlug || c.id === collectionSlug);

  const fields = useMemo(() => {
    const raw = collection?.fields ?? [];
    if (Array.isArray(raw)) return raw as FieldDef[];
    try { return JSON.parse(raw as any) as FieldDef[]; } catch { return []; }
  }, [collection]);

  if (!collectionSlug) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {t("Place this block inside a Repeater with a collection selected.")}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex-1 rounded border border-input bg-background px-2 py-1 text-left text-xs text-foreground hover:bg-accent truncate">
            {value ? (
              <span className="font-mono">{value}</span>
            ) : (
              <span className="text-muted-foreground">{schema?.placeholder ?? t("Select a field…")}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="z-[1000]! w-64 p-0" align="start">
          <FieldPicker
            fields={fields}
            collections={allCollections}
            onSelect={(path) => {
              onChange(path);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Cross1Icon className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
