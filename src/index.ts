/* istanbul ignore file */

import * as tss from "typescript/lib/tsserverlibrary";
import util from "util";
import CssParser from "./CssParser";
import ExportGenerator from "./ExportGenerator";
import FileUtils from "./FileUtils";
import IOptions from "./IOptions";
import Logger from "./Logger";
import ModuleResolver from "./ModuleResolver";

let logger: Logger;

const init = ({ typescript: ts }: { typescript: typeof tss }) => {
    const create = (info: tss.server.PluginCreateInfo): ts.LanguageService => {

        const options: IOptions = info.config.options || {};
        logger = new Logger(info.project.projectService.logger, options);

        logger.log(`Initialize with options: ${util.inspect(options, false, null, true)}`);

        const cssParser = new CssParser(logger, options);
        const exportGenerator = new ExportGenerator(options);
        const fileUtils = new FileUtils(options);

        const createSnapshot = (scriptSnapshot: tss.IScriptSnapshot) => {
            const css = fileUtils.getSourceCode(scriptSnapshot);
            if (css.match(/declare const style/)) {
                return null;
            }

            const classes = cssParser.getClasses(css);
            if (classes === null) {
                return null;
            }

            const dts = exportGenerator.generate(classes);

            return ts.ScriptSnapshot.fromString(dts);
        };

        const oldCreateLanguageServiceSourceFile = ts.createLanguageServiceSourceFile;
        ts.createLanguageServiceSourceFile = (fileName, scriptSnapshot, ...additionalParameters): ts.SourceFile => {

            // Note: For (currently) unknown reason this is now called twice!
            //       Once for the original file and once again for the generated declaration file..
            //       We try to work around this by catching errors in node-sass processing and using null response.
            let wasParsedSuccessful = false;
            if (fileUtils.isModulePath(fileName)) {
                logger.log(`Getting css snapshots from: ${fileName}`);

                const newSnapshot = createSnapshot(scriptSnapshot);
                if (newSnapshot !== null) {
                    scriptSnapshot = newSnapshot;
                    wasParsedSuccessful = true;
                }
            }

            // @ts-ignore
            const sourceFile = oldCreateLanguageServiceSourceFile(fileName, scriptSnapshot, ...additionalParameters);

            if (wasParsedSuccessful) {
                sourceFile.isDeclarationFile = true;
            }

            return sourceFile;
        };

        const oldUpdateLanguageServiceSourceFile = ts.updateLanguageServiceSourceFile;
        ts.updateLanguageServiceSourceFile = (sourceFile, scriptSnapshot, ...rest): ts.SourceFile => {

            let wasParsedSuccessful = false;
            if (fileUtils.isModulePath(sourceFile.fileName)) {
                logger.log(`Update css snapshots for: ${sourceFile.fileName}`);

                const newSnapshot = createSnapshot(scriptSnapshot);
                if (newSnapshot !== null) {
                    scriptSnapshot = newSnapshot;
                    wasParsedSuccessful = true;
                }
            }

            // @ts-ignore
            sourceFile = oldUpdateLanguageServiceSourceFile(sourceFile, scriptSnapshot, ...rest);

            if (wasParsedSuccessful) {
                sourceFile.isDeclarationFile = true;
            }

            return sourceFile;
        };

        if (info.languageServiceHost.resolveModuleNames) {
            const resolver = new ModuleResolver(logger);

            logger.log(`Create resolver for resolveModuleNames`);
            info.languageServiceHost.resolveModuleNames = resolver.createResolver(info, fileUtils);
        }

        return info.languageService;
    };

    const getExternalFiles = (project: tss.server.Project): Array<string> | undefined => {
        const fileUtil = new FileUtils();

        return project.getFileNames().filter(fileUtil.isModulePath);
    };

    return {
        create,
        getExternalFiles,
    };
};

export = init;
