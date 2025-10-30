import { INodeType, INodeExecutionData, IExecuteFunctions,INodeTypeDescription, NodeConnectionType, INodeInputConfiguration, INodeOutputConfiguration } from 'n8n-workflow';
import { join } from 'path';
import { platform } from 'os';
import { getBrowserExecutablePath } from './utils';
import { handleOperation } from './operations';
import { IBrowserOptions } from './types';
import { installBrowser } from '../scripts/setup-browsers';
import { BrowserType } from './config';

export class PlaywrightExt implements INodeType {
    description : INodeTypeDescription = {
    displayName: 'Playwright (EXT)',
    name: 'playwrightExt',
    icon: 'file:playwright.svg',
    group: ['automation'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Automate browser actions using Playwright',
    defaults: {
        name: 'Playwright (EXT)',
    },
    // eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
    inputs: [
        {
            displayName: 'Input',
            type: NodeConnectionType.Main,
        } as INodeInputConfiguration,
    ],
    // eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
    outputs: [
        {
            displayName: 'Output',
            type: NodeConnectionType.Main,
        } as INodeOutputConfiguration,
    ],

    properties: [
        {
            displayName: 'Operation',
            name: 'operation',
            type: 'options',
            noDataExpression: true,
            options: [
                {
                    name: 'Click Element',
                    value: 'clickElement',
                    description: 'Click on an element',
																				action: 'Click on an element',
                },
                {
                    name: 'Fill Form',
                    value: 'fillForm',
                    description: 'Fill a form field',
																				action: 'Fill a form field',
                },
                {
                    name: 'Get Text',
                    value: 'getText',
                    description: 'Get text from an element',
																				action: 'Get text from an element',
                },
                {
                    name: 'Navigate',
                    value: 'navigate',
                    description: 'Navigate to a URL',
																				action: 'Navigate to a URL',
                },
                {
                    name: 'Take Screenshot',
                    value: 'takeScreenshot',
                    description: 'Take a screenshot of a webpage',
																				action: 'Take a screenshot of a webpage',
                }
            ],
            default: 'navigate',
        },

        {
            displayName: 'URL',
            name: 'url',
            type: 'string',
            default: '',
            placeholder: 'https://example.com',
            description: 'The URL to navigate to',
            displayOptions: {
                show: {
                    operation: ['navigate', 'takeScreenshot', 'getText', 'clickElement', 'fillForm'],
                },
            },
            required: true,
        },
				{
    displayName: 'Property Name',
    name: 'dataPropertyName',
    type: 'string',
    required: true,
    default: 'screenshot',
    description: 'Name of the binary property in which to store the screenshot data',
    displayOptions: {
        show: {
            operation: ['takeScreenshot'],
        },
    },
},
        {
            displayName: 'Selector',
            name: 'selector',
            type: 'string',
            default: '',
            placeholder: '#submit-button',
            description: 'CSS selector for the element',
            displayOptions: {
                show: {
                    operation: ['getText', 'clickElement', 'fillForm'],
                },
            },
            required: true,
        },
        {
            displayName: 'Value',
            name: 'value',
            type: 'string',
            default: '',
            description: 'Value to fill in the form field',
            displayOptions: {
                show: {
                    operation: ['fillForm'],
                },
            },
            required: true,
        },
        {
            displayName: 'Browser',
            name: 'browser',
            type: 'options',
            options: [
                {
                    name: 'Chromium',
                    value: 'chromium',
                },
                {
                    name: 'Firefox',
                    value: 'firefox',
                },
                {
                    name: 'Webkit',
                    value: 'webkit',
                },
            ],
            default: 'chromium',
        },
        {
            displayName: 'Browser Launch Options',
            name: 'browserOptions',
            type: 'collection',
            placeholder: 'Add Option',
            default: {},
            options: [
                {
                    displayName: 'Headless',
                    name: 'headless',
                    type: 'boolean',
                    default: true,
                    description: 'Whether to run browser in headless mode',
                },
                {
                    displayName: 'Slow Motion',
                    name: 'slowMo',
                    type: 'number',
                    default: 0,
                    description: 'Slows down operations by the specified amount of milliseconds',
                }
            ],
        },
        {
            displayName: 'Screenshot Options',
            name: 'screenshotOptions',
            type: 'collection',
            placeholder: 'Add Option',
            default: {},
            displayOptions: {
                show: {
                    operation: ['takeScreenshot'],
                },
            },
            options: [
                {
                    displayName: 'Full Page',
                    name: 'fullPage',
                    type: 'boolean',
                    default: false,
                    description: 'Whether to take a screenshot of the full scrollable page',
                },
                {
                    displayName: 'Path',
                    name: 'path',
                    type: 'string',
                    default: '',
                    description: 'The file path to save the screenshot to',
                },
            ],
        },
    ],
};

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            const operation = this.getNodeParameter('operation', i) as string;
            const url = this.getNodeParameter('url', i) as string;
            const browserType = this.getNodeParameter('browser', i) as BrowserType;
            const browserOptions = this.getNodeParameter('browserOptions', i) as IBrowserOptions;

            try {
                const playwright = require('playwright');
                const browsersPath = join(__dirname, '..', 'browsers');

                // Add better error handling for browser executable
                let executablePath;
                try {
                    executablePath = getBrowserExecutablePath(browserType, browsersPath);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    console.error(`Browser path error: ${msg}`);
                    // Try to install missing browser
                    await installBrowser(browserType);
                    executablePath = getBrowserExecutablePath(browserType, browsersPath);
                }

                console.log(`Launching browser from: ${executablePath}`);

                const browser = await playwright[browserType].launch({
                    headless: browserOptions.headless !== false,
                    slowMo: browserOptions.slowMo || 0,
                    executablePath,
                });

                const context = await browser.newContext();
                const page = await context.newPage();
                await page.goto(url);

								const result = await handleOperation(operation, page, this, i);
								// console.log(`Operation result:`, result);
                await browser.close();

                returnData.push(result );
            } catch (error) {
                console.error(`Browser launch error:`, error);
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            error: error instanceof Error ? error.message : String(error),
                            browserType,
                            os: platform(),
                        },
                    });
                    continue;
                }
                throw error;
            }
        }

        return [returnData];
    }
}
