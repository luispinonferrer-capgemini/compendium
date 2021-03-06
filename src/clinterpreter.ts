import { ConfluenceServiceImpl } from './confluenceService';
import * as fs from 'fs';
import {
  IndexSource,
  IndexNode,
  Index,
  TextInSources,
  Transcript,
  TextOut,
  Merger,
  DocConfig,
  Cookie,
  Cookies,
  Credentials,
  ConfluenceService,
} from './types';
import { AsciiDocFileTextIn } from './asciidocInput';
import { AsciiDocFileTextOut } from './asciidocOutput';
import { MarkdownFileTextOut } from './markdownOutput';
import { MarkdownTextIn } from './markdownInput';
import { HtmlFileTextOut } from './htmlOutput';
import { PdfFileTextOut } from './pdfOutput';
import { MergerImpl } from './merger';
import { ConfigFile } from './config';
import { ConfluenceTextIn } from './confluenceInput';
import { InputUrlTextIn } from './inputUrl';
import { Utilities } from './utils';
import chalk from 'chalk';
import * as shelljs from 'shelljs';
import * as util from 'util';
import { ConnectorApi } from '../src/connectorApi';
import * as extrafs from 'fs-extra';

/**
 * doCompendium
 * Read the information introduced in the CLI to interpreted it and create the final file
 * @export
 * @param {string} configFile
 * @param {string} format
 * @param {(string | undefined)} outputFile
 */
export async function doCompendium(
  configFile: string,
  format: string,
  outputFile: string | undefined,
) {
  let docconfig: ConfigFile;
  let fileOutput: TextOut;
  let merger: Merger;
  let index;
  let COOKIES_INTERNAL: Cookies = [];

  docconfig = new ConfigFile(configFile);
  try {
    index = await docconfig.getIndex();
  } catch (err) {
    throw new Error(err.message);
  }

  let output = 'result';
  if (outputFile) {
    output = outputFile;
  }

  if (format === 'asciidoc') {
    fileOutput = new AsciiDocFileTextOut(output);
  } else if (format === 'html') {
    fileOutput = new HtmlFileTextOut(output);
  } else if (format === 'pdf') {
    fileOutput = new PdfFileTextOut(output);
  } else if (format === 'markdown') {
    fileOutput = new MarkdownFileTextOut(output);
  } else {
    const msg = "Format '" + format + "' is not implemented";
    throw new Error(msg);
  }

  const textinSources: TextInSources = {};
  for (const source of index[0]) {
    //ASCIIDOC type --------------------------------------------------------------
    if (source.source_type === 'asciidoc') {
      textinSources[source.reference] = new AsciiDocFileTextIn(source.source);
      //CONFLUENCE type -----------------------------------------------------------
    } else if (source.source_type === 'markdown') {
      textinSources[source.reference] = new MarkdownTextIn(source.source);
    } else if (source.source_type === 'confluence') {
      if (source.context === 'capgemini') {
        //CONFLUENCE INTERNAL NETWORK
        //get the cookie session brandNewDayProd with the API only if does not exist yet
        //this is because the cookie give you access to all the internal sources
        if (
          COOKIES_INTERNAL.length === 0 ||
          COOKIES_INTERNAL[0].name !== 'brandNewDayProd' ||
          !COOKIES_INTERNAL[0].value ||
          COOKIES_INTERNAL[0].value === ''
        ) {
          COOKIES_INTERNAL.push(await getSessionCookieByConnectorApi(source));
        }
        //text in constructor
        textinSources[source.reference] = new ConfluenceTextIn(
          source.source,
          source.space,
          COOKIES_INTERNAL,
        );
      } else {
        //CONFLUENCE EXTERNAL ACCOUNT
        //need credentials first
        let credentials: Credentials;
        try {
          console.log(
            chalk.bold(
              `Please enter credentials for source with key '${chalk.green.italic(
                source.reference,
              )}' (${chalk.blue(source.source)})\n`,
            ),
          );
          credentials = await askInPrompt();
        } catch (err) {
          throw new Error(err.message);
        }
        //text in constructor
        try {
          textinSources[source.reference] = new ConfluenceTextIn(
            source.source,
            source.space,
            credentials,
          );
        } catch (err) {
          throw new Error(err.message);
        }
      }
      //URL-HTML type -------------------------------------------------------------------
    } else if (source.source_type === 'url-html') {
      textinSources[source.reference] = new InputUrlTextIn(source.source);
    } else {
      throw new Error('Unknown TextInSource');
    }
    //is_index -------------------------------------------------------------
    //Check if the source has a is_index true
    //if not exists position -1, if exists position >=0
    let documentIsIndexPosition: number = Utilities.findDocumentIsIndex(
      index[1],
      source.reference,
    );
    if (documentIsIndexPosition >= 0) {
      //Index exists but only go ahead if source type supports it
      if (textinSources[source.reference].supportsExport()) {
        let arrayTitles = await textinSources[source.reference].getIndexList(
          index[1][documentIsIndexPosition].document,
        );

        if (arrayTitles.length > 0) {
          //delete the index page as we dont need it any more
          //save the list inside the index for future document get Transcript reading
          index[1][documentIsIndexPosition] = {
            reference: source.reference,
            document: arrayTitles[0],
          };
          arrayTitles.shift();

          for (let title of arrayTitles) {
            index[1].push({
              reference: source.reference,
              document: title,
            });
          }
        } else {
          console.log('No links meeting requirements inside the index page');
        }
      } else {
        throw new Error(
          'Source type: ' +
            source.source_type +
            ' not supports export all documents from index. ',
        );
      }
    }
  }
  //create folder output if necessary ----------------------------------------------------------
  if (output.split('/').length > 1) {
    let aux = output.split('/');
    let aux1 = aux.splice(0, aux.length - 1);
    const myOutput = aux1.join('/');
    try {
      await extrafs.ensureDir(myOutput);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }
  //get the transcript of all the documents and sources -----------------------------------
  merger = new MergerImpl();
  try {
    await merger.merge(textinSources, index, fileOutput);
  } catch (e) {
    console.error(e.message);
  }

  console.log('\n Process finished!');
}
/**
 * askInPrompt
 * Ask for the username and password if you introduce an input file that needs credentials to read it
 * @export
 * @returns {Promise<Credentials>}
 */
export async function askInPrompt(): Promise<Credentials> {
  const prompt = require('prompt');
  let credentials: Credentials;

  const promise = new Promise<Credentials>((resolve, reject) => {
    prompt.start();

    prompt.get(
      [
        {
          name: 'username',
          required: true,
        },
        {
          name: 'password',
          hidden: true,
          replace: '*',
          required: true,
        },
      ],
      (err: any, result: any) => {
        credentials = {
          username: result.username,
          password: result.password,
        };
        if (credentials) {
          resolve(credentials);
        } else {
          reject(err.message);
        }
      },
    );
  });

  return promise;
}
/**
 * dirExists
 * Check if the directory introduce exist
 * @param {string} filename
 * @returns boolean
 */
async function dirExists(filename: string) {
  try {
    let accessPromisify = util.promisify(fs.access);
    await accessPromisify(filename);
    return true;
  } catch (e) {
    return false;
  }
}
/*
* get the session cookie of the internal network SSO
* The brandNewDayProd cookie is a door gate for confluence sources
*/
export async function getSessionCookieByConnectorApi(
  source: IndexSource,
): Promise<Cookie> {
  //need credentials first
  let credentials: Credentials;
  try {
    console.log(
      chalk.bold(
        `Please enter credentials for source with key '${chalk.green.italic(
          source.reference,
        )}' (${chalk.blue(source.source)})\n`,
      ),
    );
    credentials = await askInPrompt();
  } catch (err) {
    throw new Error(err.message);
  }
  let connectorApi: ConnectorApi = new ConnectorApi(
    credentials.username,
    credentials.password,
    '',
  );
  let brandCookieValue: string;
  try {
    //get the cookie
    let cookiesResult = await connectorApi.connect();
    //format the cookie into our interface Cookie
    let cookieBrand = cookiesResult[0].toString();
    let aux1 = cookieBrand.split(';');
    let aux2 = aux1[0].split('=');
    brandCookieValue = aux2[1];
  } catch (error) {
    throw new Error(
      'Error: Can not get the capgemini session cookie: ' + error.message,
    );
  }
  //build the cookie
  const brandNewDayProdCookie: Cookie = {
    name: 'brandNewDayProd',
    value: brandCookieValue,
  };
  return brandNewDayProdCookie;
}
