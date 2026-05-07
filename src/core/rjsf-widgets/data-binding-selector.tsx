import { first, get, has, isArray, isEmpty, isObject, startsWith } from "lodash-es";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePageExternalData } from "~/atoms/builder";
import { NestedPathSelector } from "~/core/components/nested-path-selector";
import { COLLECTION_PREFIX, REPEATER_PREFIX } from "~/core/constants/STRINGS";
import { useBuilderProp } from "~/hooks/use-builder-prop";
import { useSelectedBlock, useSelectedBlockHierarchy } from "~/hooks/use-selected-blockIds";
import { useAllDataProviders } from "~/hooks/use-all-data-providers";
import { isRepeaterBlock } from "../utils/block-utils";

export const DataBindingSelector = ({
  schema,
  onChange,
  id,
  formData,
}: {
  schema: any;
  onChange: (value: any, formData: any, id: string) => void;
  id: string;
  formData: any;
}) => {
  const [fallbackCollections, setFallbackCollections] = useState<any[]>([]);
  const pageExternalData = usePageExternalData();
  const dataBindingEnabled = useBuilderProp("flags.dataBinding", true);
  const collections = useBuilderProp("collections", []) as any[];
  const hierarchy = useSelectedBlockHierarchy();
  const selectedBlock = useSelectedBlock();
  const repeaterBlock = useMemo(() => hierarchy.find((block) => isRepeaterBlock(block)), [hierarchy]);
  const repeaterCollectionSlug = useMemo(() => get(repeaterBlock, "collectionSlug", ""), [repeaterBlock]);

  useEffect(() => {
    if (!repeaterCollectionSlug || typeof window === "undefined") {
      setFallbackCollections([]);
      return;
    }

    const getProjectIdFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const queryProjectId = params.get("projectId");
      if (queryProjectId) return queryProjectId;
      const pathMatch = window.location.pathname.match(/\/projects\/([^/]+)\//);
      return pathMatch?.[1] ?? null;
    };

    const projectId = getProjectIdFromUrl();
    if (!projectId) {
      setFallbackCollections([]);
      return;
    }

    let isActive = true;
    fetch(`/api/collections?projectId=${projectId}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!isActive || !Array.isArray(payload)) return;
        const selected = payload.find(
          (item) => item?.slug === repeaterCollectionSlug || item?.id === repeaterCollectionSlug,
        );
        if (selected) setFallbackCollections(payload);
      })
      .catch(() => {
        if (isActive) setFallbackCollections([]);
      });

    return () => {
      isActive = false;
    };
  }, [repeaterCollectionSlug]);

  const repeaterSourceKey = useMemo(() => {
    if (hierarchy.length === 1) return "";
    const repeaterItems = get(repeaterBlock, "repeaterItems", "");
    if (typeof repeaterItems !== "string") return "";
    return repeaterItems.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, "").trim();
  }, [hierarchy, repeaterBlock]);

  const repeaterKey = useMemo(() => {
    if (isEmpty(repeaterSourceKey) && !repeaterCollectionSlug) return "";
    if (!repeaterBlock?._id) return "";
    const availableCollections = collections.length > 0 ? collections : fallbackCollections;

    const getCollectionDisplayName = (collectionRef: string) => {
      const matchedCollection = availableCollections.find(
        (item) => item?.id === collectionRef || item?.slug === collectionRef || item?.name === collectionRef,
      );
      return (
        matchedCollection?.name ||
        matchedCollection?.label ||
        matchedCollection?.title ||
        matchedCollection?.slug ||
        collectionRef
      );
    };

    if (isEmpty(repeaterSourceKey) && repeaterCollectionSlug) {
      const collectionDisplayName = getCollectionDisplayName(repeaterCollectionSlug);
      const collectionKey = String(collectionDisplayName).trim();
      return `${REPEATER_PREFIX}${COLLECTION_PREFIX}${collectionKey}`;
    }

    const key = (() => {
      if (!startsWith(repeaterSourceKey, COLLECTION_PREFIX)) return repeaterSourceKey;
      const collectionRef = repeaterSourceKey.replace(COLLECTION_PREFIX, "");
      const collectionDisplayName = String(getCollectionDisplayName(collectionRef)).trim();
      return `${COLLECTION_PREFIX}${collectionDisplayName}/${repeaterBlock?._id}`;
    })();
    return `${REPEATER_PREFIX}${key}`;
  }, [repeaterBlock, repeaterSourceKey, repeaterCollectionSlug, collections, fallbackCollections]);

  const repeaterData = useMemo(() => {
    if (isEmpty(repeaterKey)) return undefined;

    // Standard SDK repeater: find runtime row data from externalData.
    if (!isEmpty(repeaterSourceKey)) {
      const repeaterResolvedDataKey = repeaterKey.replace(REPEATER_PREFIX, "");
      const candidates = [repeaterResolvedDataKey, repeaterSourceKey];
      for (const key of candidates) {
        const source = has(pageExternalData, key) ? get(pageExternalData, key) : get(pageExternalData, [key]);
        if (isArray(source)) return first(source);
        if (isObject(source)) return source;
      }
    }

    // Custom repeater (repeaterGrid/repeaterList): build field tree from collection schema.
    if (repeaterCollectionSlug) {
      const availableCollections = collections.length > 0 ? collections : fallbackCollections;
      const collection = availableCollections.find(
        (item) => item?.id === repeaterCollectionSlug || item?.slug === repeaterCollectionSlug,
      );
      const directFields = get(collection, "fields", []) as any;
      let fields: any[] = [];
      if (Array.isArray(directFields)) {
        fields = directFields;
      } else if (typeof directFields === "string") {
        try {
          const parsed = JSON.parse(directFields);
          fields = Array.isArray(parsed) ? parsed : [];
        } catch {
          fields = [];
        }
      }
      const buildCollectionShape = (
        currentFields: any[],
        depth = 0,
        seen = new Set<string>(),
      ): Record<string, any> => {
        return currentFields.reduce<Record<string, any>>((acc, field) => {
          const key = field?.name || field?.id;
          if (!key) return acc;
          if (field?.type === "relation" && field?.targetCollection && depth < 2 && !seen.has(field.targetCollection)) {
            const nextSeen = new Set(seen);
            nextSeen.add(field.targetCollection);
            const nestedCollection = availableCollections.find(
              (item) => item?.slug === field.targetCollection || item?.id === field.targetCollection,
            );
            const nestedFieldsRaw = get(nestedCollection, "fields", []);
            const nestedFields =
              typeof nestedFieldsRaw === "string"
                ? (() => {
                    try {
                      const parsed = JSON.parse(nestedFieldsRaw);
                      return Array.isArray(parsed) ? parsed : [];
                    } catch {
                      return [];
                    }
                  })()
                : Array.isArray(nestedFieldsRaw)
                  ? nestedFieldsRaw
                  : [];
            acc[key] = buildCollectionShape(nestedFields, depth + 1, nextSeen);
            return acc;
          }
          acc[key] = "";
          return acc;
        }, {});
      };

      if (fields.length > 0) {
        return buildCollectionShape(fields);
      }
    }

    return undefined;
  }, [repeaterSourceKey, repeaterKey, pageExternalData, repeaterCollectionSlug, collections, fallbackCollections]);

  const allProviders = useAllDataProviders();
  const labelToKeyMap = useMemo(() => {
    const map: Record<string, string> = {};
    allProviders.forEach((provider: any) => {
      const label = typeof provider.label === "function" ? provider.label() : (provider.label || provider.key);
      map[label] = provider.key;
    });
    return map;
  }, [allProviders]);

  const providersData = useMemo(() => {
    const data: Record<string, any> = {};
    allProviders.forEach((provider: any) => {
      if (provider.fields) {
        const label = typeof provider.label === "function" ? provider.label() : (provider.label || provider.key);
        data[label] = typeof provider.fields === "function" ? provider.fields() : provider.fields;
      }
    });
    return data;
  }, [allProviders]);

  const handlePathSelect = useCallback(
    (path: string, type: "value" | "array" | "object") => {
      let finalPath = path;
      const parts = path.split(".");
      if (parts.length > 0 && labelToKeyMap[parts[0]]) {
        parts[0] = labelToKeyMap[parts[0]];
        finalPath = parts.join(".");
      }
      path = !isEmpty(repeaterKey) ? finalPath.replace(`${repeaterKey}`, "$index") : finalPath;
      // if type is array or object, replace the current value with the new value
      if (type === "array" || type === "object") {
        onChange(`{{${path}}}`, {}, id);
        return;
      }

      // Helper function to check if character is punctuation
      const isPunctuation = (char: string) => /[.,!?;:]/.test(char);

      // Helper function to add smart spacing around a placeholder
      const addSmartSpacing = (text: string, position: number, placeholder: string) => {
        // Determine if we need spacing
        let prefix = "";
        let suffix = "";

        // Get characters before and after cursor
        const charBefore = position > 0 ? text[position - 1] : "";
        const charAfter = position < text.length ? text[position] : "";

        // Handle spacing before placeholder
        if (position > 0) {
          // Always add space after a period/full stop
          if (charBefore === ".") {
            prefix = " ";
          }
          // For other cases, add space if not punctuation and not already a space
          else if (!isPunctuation(charBefore) && charBefore !== " ") {
            prefix = " ";
          }
        }

        // Handle spacing after placeholder
        if (position < text.length && !isPunctuation(charAfter) && charAfter !== " ") {
          suffix = " ";
        }

        return {
          text: prefix + placeholder + suffix,
          prefixLength: prefix.length,
          suffixLength: suffix.length,
        };
      };

      // Get the element by ID
      const element = document.getElementById(id);
      if (!element) return;

      // Check if this is a Tiptap editor by looking for the chai-rte container
      const rteContainer = document.getElementById(`chai-rte-${id}`) || document.getElementById(`chai-rte-modal-${id}`);

      if (rteContainer && (rteContainer.querySelector(".ProseMirror") || (rteContainer as any).__chaiRTE)) {
        // Handle Tiptap editor
        // Access the Tiptap instance that was attached in the RTEField component
        const editor = (rteContainer as any).__chaiRTE;

        if (editor) {
          // Create the placeholder
          const basePlaceholder = `{{${finalPath}}}`;

          // Focus the editor first to ensure we can get/set selection
          editor.commands.focus();

          // Check if there's a selection
          const { from, to } = editor.state.selection;
          const hasSelection = from !== to;

          if (hasSelection) {
            // If there's a selection, replace it with the placeholder
            editor.chain().deleteSelection().insertContent(basePlaceholder).run();
          } else {
            // No selection, just insert at cursor position
            // Get the text around the cursor to determine spacing
            const { state } = editor;
            const cursorPos = state.selection.from;

            // Get text before and after cursor for smart spacing
            const textBefore = state.doc.textBetween(Math.max(0, cursorPos - 1), cursorPos);
            const textAfter = state.doc.textBetween(cursorPos, Math.min(cursorPos + 1, state.doc.content.size));

            // Determine if we need spacing before the placeholder
            let prefix = "";
            if (cursorPos > 0 && textBefore !== " " && !isPunctuation(textBefore)) {
              prefix = " ";
            }

            // Determine if we need spacing after the placeholder
            let suffix = "";
            if (textAfter && textAfter !== " " && !isPunctuation(textAfter)) {
              suffix = " ";
            }

            // Insert the placeholder with smart spacing
            editor
              .chain()
              .insertContent(prefix + basePlaceholder + suffix)
              .run();
          }

          // Update the form data with the new content
          // Use setTimeout to ensure the state has been updated
          setTimeout(() => onChange(editor.getHTML(), {}, id), 100);
          return;
        }
      } else {
        // Handle regular input field
        const input = element as HTMLInputElement;
        const cursorPos = input.selectionStart || 0;
        const currentValue = input.value || "";

        // Check if there's any text selection
        const selectionEnd = input.selectionEnd || cursorPos;
        const hasSelection = selectionEnd > cursorPos;

        // If text is selected, replace it with the shortcode
        if (hasSelection) {
          const basePlaceholder = `{{${finalPath}}}`;
          const { text: placeholderWithSpacing } = addSmartSpacing(currentValue, cursorPos, basePlaceholder);

          const newValue = currentValue.slice(0, cursorPos) + placeholderWithSpacing + currentValue.slice(selectionEnd);

          // Call onChange with the new formData
          onChange(newValue, {}, id);
          return;
        }

        // No selection, just insert at cursor position with smart spacing
        const basePlaceholder = `{{${finalPath}}}`;
        const { text: placeholderWithSpacing } = addSmartSpacing(currentValue, cursorPos, basePlaceholder);

        // Create the new value with smart spacing
        const newValue = currentValue.slice(0, cursorPos) + placeholderWithSpacing + currentValue.slice(cursorPos);

        // Call onChange with the new formData
        onChange(newValue, {}, id);
      }
    },
    [id, onChange, formData, selectedBlock?._id, repeaterKey, labelToKeyMap],
  );


  if (!dataBindingEnabled) {
    return null;
  }
  return (
    <NestedPathSelector
      data={{
        ...((repeaterData && { [repeaterKey]: repeaterData }) as any),
        ...providersData,
        ...pageExternalData,
      }}
      onSelect={handlePathSelect}
      dataType={schema.binding === "array" ? "array" : "value"}
    />
  );
};
