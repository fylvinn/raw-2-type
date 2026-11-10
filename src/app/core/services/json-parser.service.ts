import { Injectable, computed, signal } from '@angular/core';
import {debouncedSignal} from '../../shared/utils/debounced-signal';

export interface ParseResult {
  cleanJson: string;
  typescriptInterfaces: string;
  error: string | null;
  errorLine: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class JsonParserService {
  // Writable Signal
  readonly rawInput = signal<string>('');

  // Debounced Signal with a 200 ms timeout
  private readonly debouncedInput = debouncedSignal(this.rawInput, 200);

  // Computed Signal
  readonly parseResult = computed<ParseResult>(() => {
    const input = this.debouncedInput().trim();

    if (!input) {
      return { cleanJson: '', typescriptInterfaces: '', error: null, errorLine: null };
    }

    try {
      const sanitized = this.sanitizeJsonString(input);
      const parsedObject = JSON.parse(sanitized);

      //camelCase keys
      const camelCasedObject = this.transformKeysToCamelCase(parsedObject);
      const cleanJson = JSON.stringify(camelCasedObject, null, 2);

      //TypeScript Interfaces
      const typescriptInterfaces = this.generateTsInterfaces(camelCasedObject, 'RootObject');

      return {
        cleanJson,
        typescriptInterfaces,
        error: null,
        errorLine: null
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown JSON syntax error';
      const errorLine = this.extractErrorLine(errorMessage, input);

      return {
        cleanJson: '',
        typescriptInterfaces: '',
        error: errorMessage,
        errorLine
      };
    }
  });

  /**
   * Initial sanitization of “raw” JSON from logs/databases
   */
  private sanitizeJsonString(raw: string): string {
    return raw
      // Replace single quotes with double quotes for keys and values
      .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
      // Removing trailing commas in objects and arrays
      .replace(/,\s*([\}\]])/g, '$1');
  }

  /**
   * Transforms all keys of an object to camelCase
   */
  private transformKeysToCamelCase(val: unknown): unknown {
    if (Array.isArray(val)) {
      return val.map(item => this.transformKeysToCamelCase(item));
    }

    if (val !== null && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      return Object.keys(obj).reduce((acc, key) => {
        const camelKey = this.toCamelCase(key);
        acc[camelKey] = this.transformKeysToCamelCase(obj[key]);
        return acc;
      }, {} as Record<string, unknown>);
    }

    return val;
  }

  /**
   * Helper for converting snake_case / kebab-case to camelCase
   */
  private toCamelCase(str: string): string {
    return str
      .replace(/[-_]([a-z0-9])/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, firstChar => firstChar.toLowerCase());
  }

  /**
   * Recursive generation of TypeScript interfaces
   */
  generateTsInterfaces(obj: unknown, rootName: string): string {
    const interfaces = new Map<string, string>();
    const interfaceNamesByShape = new Map<string, string>();
    const usedNames = new Set<string>();

    const typeName = (name: string): string => {
      const pascalName = name
        .split(/[^a-zA-Z0-9_$]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      const safeName = pascalName || 'NestedObject';
      return /^[a-zA-Z_$]/.test(safeName) ? safeName : `_${safeName}`;
    };

    const allocateName = (candidate: string): string => {
      const baseName = typeName(candidate);
      let name = baseName;
      let suffix = 2;
      while (usedNames.has(name)) {
        name = `${baseName}${suffix++}`;
      }
      usedNames.add(name);
      return name;
    };

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value);

    const buildObjectType = (
      records: Record<string, unknown>[],
      suggestedName: string,
      forceName = false
    ): string => {
      const keys = Array.from(new Set(records.flatMap(record => Object.keys(record))));
      const fields = keys.map(key => {
        const values = records
          .filter(record => Object.prototype.hasOwnProperty.call(record, key))
          .map(record => record[key]);
        const optional = values.length < records.length;
        const fieldName = /^[$A-Z_a-z][$\w]*$/.test(key) ? key : JSON.stringify(key);
        const optionalMarker = optional ? '?' : '';
        const fieldType = inferType(values, key);
        return {
          key,
          optional,
          type: fieldType,
          declaration: `  ${fieldName}${optionalMarker}: ${fieldType};`
        };
      });

      const signature = fields
        .map(field => JSON.stringify([field.key, field.optional, field.type]))
        .sort()
        .join(';');

      if (!forceName) {
        const existingName = interfaceNamesByShape.get(signature);
        if (existingName) return existingName;
      }

      const name = allocateName(suggestedName);
      const code = `export interface ${name} {\n${fields.map(field => field.declaration).join('\n')}\n}`;
      interfaces.set(name, code);
      interfaceNamesByShape.set(signature, name);
      return name;
    };

    const inferType = (values: unknown[], suggestedName: string): string => {
      const members: string[] = [];
      const addMember = (member: string): void => {
        if (!members.includes(member)) members.push(member);
      };

      const objectValues = values.filter(isRecord);
      if (objectValues.length > 0) {
        addMember(buildObjectType(objectValues, suggestedName));
      }

      const arrays = values.filter(Array.isArray);
      if (arrays.length > 0) {
        const elements = arrays.flatMap(array => array);
        if (elements.length === 0) {
          addMember('unknown[]');
        } else {
          const elementType = inferType(elements, `${suggestedName}Item`);
          addMember(elementType.includes(' | ') ? `(${elementType})[]` : `${elementType}[]`);
        }
      }

      for (const primitiveType of ['string', 'number', 'boolean'] as const) {
        if (values.some(value => typeof value === primitiveType)) addMember(primitiveType);
      }

      if (values.some(value => value === null)) addMember('null');

      if (members.length === 0) return 'unknown';
      return members.length === 1 ? members[0] : members.join(' | ');
    };

    const records = Array.isArray(obj)
      ? obj.filter(isRecord)
      : isRecord(obj) ? [obj] : [];
    if (records.length > 0) {
      buildObjectType(records, Array.isArray(obj) ? `${rootName}Item` : rootName, !Array.isArray(obj));
    }

    return Array.from(interfaces.values()).reverse().join('\n\n');
  }

  /**
   * Extracts the line number of an error from the V8 / JavaScript Engine error message
   */
  private extractErrorLine(errorMessage: string, input: string): number | null {
    const positionMatch = errorMessage.match(/at position (\d+)/i) || errorMessage.match(/column (\d+)/i);
    if (positionMatch && positionMatch[1]) {
      const pos = parseInt(positionMatch[1], 10);
      return input.substring(0, pos).split('\n').length;
    }
    return null;
  }
}
