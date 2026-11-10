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
  private generateTsInterfaces(obj: unknown, rootName: string): string {
    const interfaces = new Map<string, string>();

    const buildType = (val: unknown, structName: string): string => {
      if (val === null) return 'any';
      if (Array.isArray(val)) {
        if (val.length === 0) return 'any[]';
        // Determine the types of the array elements
        const itemTypes = Array.from(new Set(val.map((item, idx) => buildType(item, `${structName}Item`))));
        return itemTypes.length === 1 ? `${itemTypes[0]}[]` : `(${itemTypes.join(' | ')})[]`;
      }

      if (typeof val === 'object') {
        const fields: string[] = [];
        const record = val as Record<string, unknown>;

        for (const [key, propValue] of Object.entries(record)) {
          const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
          const childTypeName = `${structName}${capitalizedKey}`;
          const typeName = buildType(propValue, childTypeName);
          fields.push(`  ${key}: ${typeName};`);
        }

        const interfaceCode = `export interface ${structName} {\n${fields.join('\n')}\n}`;
        interfaces.set(structName, interfaceCode);
        return structName;
      }

      return typeof val;
    };

    buildType(obj, rootName);
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
