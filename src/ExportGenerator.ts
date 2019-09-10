import { CSSExports } from "icss-utils";
import { camelCase } from "lodash";
import IOptions from "./IOptions";

export default class ExportGenerator {

    private readonly options: IOptions;

    public constructor(options: IOptions) {
        this.options = options;
    }

    public generate(classes: CSSExports) {
        const classNames = Object.keys(classes)
            .map(className => this.transformClassName(className))
            // Flatter array because transformClassName() may return multiple classes
            .reduce((previousValue: Array<string> = [], currentValue: Array<string>) => {
                return previousValue.concat(currentValue);
            }, []);

        return `\
declare const styles: {
  [index: ${classNames.map(className => `"${className}"`).join(" | ")}]: string;

${classNames.map(className => `  "${className}": string;`).join("\n")}
};

export default styles;

${
    classNames
        .filter(className => !className.match(/[^a-z0-9_]/))
        .map(className => `export const ${className};`).join("\n")
}
        `;
    }

    public transformClassName(className: string) {
        const dashesCamelCase = (dashedClassName: string) => {
            return dashedClassName.replace(/-+(\w)/g, (match, firstLetter) => firstLetter.toUpperCase());
        };

        const entries: Array<string> = [];

        switch (this.options.camelCase) {
            case true:
                entries.push(className);
                const camelCaseClassName = camelCase(className);
                if (camelCaseClassName !== className) {
                    entries.push(camelCaseClassName);
                }
                break;

            case "dashes":
                entries.push(className);
                const dashesCamelCaseClassName = dashesCamelCase(className);
                if (dashesCamelCaseClassName !== className) {
                    entries.push(dashesCamelCaseClassName);
                }
                break;

            case "only":
                entries.push(camelCase(className));
                break;

            case "dashesOnly":
                entries.push(dashesCamelCase(className));
                break;

            default:
                entries.push(className);
                break;
        }

        return entries;
    }
}
