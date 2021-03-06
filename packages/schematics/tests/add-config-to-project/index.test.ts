import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';

import { Schema } from '../../src/add-config-to-project/schema';

const schematicRunner = new SchematicTestRunner(
  '@angular-eslint/schematics',
  path.join(__dirname, '../../src/collection.json'),
);

let workspaceTree: UnitTestTree;

const testProjectName = 'foo';
const testDefaultStyleProjectName = 'default-style-application';

schematicRunner.registerCollection(
  '@schematics/angular',
  path.join(
    __dirname,
    '../../../../node_modules/@schematics/angular/collection.json',
  ),
);

function setupAngularWorkspace(workspaceTree: UnitTestTree): void {
  workspaceTree.create('tsconfig.base.json', JSON.stringify({}));
  workspaceTree.create('package.json', JSON.stringify({}));
  workspaceTree.create(
    'angular.json',
    JSON.stringify({
      $schema: './node_modules/@angular/cli/lib/config/schema.json',
      version: 1,
      newProjectRoot: 'projects',
      projects: {
        [testDefaultStyleProjectName]: {
          projectType: 'application',
          schematics: {},
          root: '',
          sourceRoot: 'src',
          prefix: 'app',
          architect: {
            build: {},
            serve: {},
            'extract-i18n': {},
            test: {},
            lint: {},
            e2e: {},
          },
        },
      },
    }),
  );
}

describe('add-config-to-project', () => {
  beforeEach(async () => {
    workspaceTree = new UnitTestTree(Tree.empty());
    setupAngularWorkspace(workspaceTree);

    await schematicRunner
      .runExternalSchematicAsync(
        '@schematics/angular',
        'application',
        {
          name: testProjectName,
          skipInstall: true,
          skipPackageJson: true,
        },
        workspaceTree,
      )
      .toPromise();
  });

  describe('default Angular CLI project (i.e. uses a src/ directory at the root of the workspace)', () => {
    it('should create an `.eslintrc.js` file in the root of the given project', async () => {
      await schematicRunner
        .runSchematicAsync<Schema>(
          'add-config-to-project',
          {
            project: testDefaultStyleProjectName,
          },
          workspaceTree,
        )
        .toPromise();

      expect(workspaceTree.exists('.eslintrc.js')).toBe(true);

      expect(workspaceTree.get('.eslintrc.js')!.content.toString())
        .toMatchInlineSnapshot(`
        "/**
         * -----------------------------------------------------
         * DISCLAIMER ON FILE TYPE USED HERE
         * -----------------------------------------------------
         *
         * We are only using the .JS version of an ESLint config file here so that we can
         * add lots of comments to better explain and document the setup.
         *
         * Using JSON in your own projects would be preferable because it can be statically
         * analyzed and therefore we can provide automated migrations as linting best practices
         * evolve over time.
         *
         * WE THEREFORE STRONGLY RECOMMEND CONVERTING THIS TO \`.eslintrc.json\` once you have
         * read through and understood the comments.
         */
        module.exports = {
          /**
           * -----------------------------------------------------
           * NOTES ON CONFIGURATION STRUCTURE
           * -----------------------------------------------------
           *
           * Out of the box, ESLint does not support TypeScript or HTML. Naturally those are the two
           * main file types we care about in Angular projects, so we have to do a little extra work
           * to configure ESLint exactly how we need to.
           *
           * Fortunately, ESLint gives us an \\"overrides\\" configuration option which allows us to set
           * different lint tooling (parser, plugins, rules etc) for different file types, which is
           * critical because our .ts files require a different parser and different rules to our
           * .html (and our inline Component) templates.
           */
          overrides: [
            /**
             * -----------------------------------------------------
             * TYPESCRIPT FILES (COMPONENTS, SERVICES ETC) (.ts)
             * -----------------------------------------------------
             */
            {
              files: ['*.ts'],
              /**
               * We use a dedicated tsconfig file for the compilation related to linting so that we
               * have complete control over what gets included and we can maximize performance
               */
              parserOptions: {
                project: './tsconfig.eslint.json',
              },
              /**
               * See packages/eslint-plugin/src/configs/README.md
               * for what this recommended config contains.
               */
              extends: ['plugin:@angular-eslint/recommended'],
              rules: {
                /**
                 * Any TypeScript related rules you wish to use/reconfigure over and above the
                 * recommended set provided by the @angular-eslint project would go here.
                 *
                 * There are some examples below from the @angular-eslint plugin and ESLint core:
                 */

                // ORIGINAL tslint.json -> \\"directive-selector\\": [true, \\"attribute\\", \\"app\\", \\"camelCase\\"],
                '@angular-eslint/directive-selector': [
                  'error',
                  { type: 'attribute', prefix: 'app', style: 'camelCase' },
                ],

                // ORIGINAL tslint.json -> \\"component-selector\\": [true, \\"element\\", \\"app\\", \\"kebab-case\\"],
                '@angular-eslint/component-selector': [
                  'error',
                  { type: 'element', prefix: 'app', style: 'kebab-case' },
                ],

                quotes: ['error', 'single', { allowTemplateLiterals: true }],
              },
            },

            /**
             * -----------------------------------------------------
             * COMPONENT TEMPLATES
             * -----------------------------------------------------
             *
             * If you use inline templates, make sure you read the notes on the configuration
             * object after this one to understand how they relate to this configuration directly
             * below.
             */
            {
              files: ['*.component.html'],
              /**
               * See packages/eslint-plugin-template/src/configs/README.md
               * for what this recommended config contains.
               */
              extends: ['plugin:@angular-eslint/template/recommended'],
              rules: {
                /**
                 * Any template/HTML related rules you wish to use/reconfigure over and above the
                 * recommended set provided by the @angular-eslint project would go here.
                 *
                 * There is an example below from ESLint core (note, this specific example is not
                 * necessarily recommended for all projects):
                 */
                'max-len': ['error', { code: 140 }],
              },
            },

            /**
             * -----------------------------------------------------
             * EXTRACT INLINE TEMPLATES (from within .component.ts)
             * -----------------------------------------------------
             *
             * This extra piece of configuration is necessary to extract inline
             * templates from within Component metadata, e.g.:
             *
             * @Component({
             *  template: \`<h1>Hello, World!</h1>\`
             * })
             * ...
             *
             * It works by extracting the template part of the file and treating it as
             * if it were a full .html file, and it will therefore match the configuration
             * specific for *.component.html above when it comes to actual rules etc.
             *
             * NOTE: This processor will skip a lot of work when it runs if you don't use
             * inline templates in your projects currently, so there is no great benefit
             * in removing it, but you can if you want to.
             *
             * You won't specify any rules here. As noted above, the rules that are relevant
             * to inline templates are the same as the ones defined for *.component.html.
             */
            {
              files: ['*.component.ts'],
              extends: ['plugin:@angular-eslint/template/process-inline-templates'],
            },
          ],
        };
        "
      `);
    });

    it('should create a `tsconfig.eslint.json` file at the root of the workspace', async () => {
      await schematicRunner
        .runSchematicAsync<Schema>(
          'add-config-to-project',
          {
            project: testDefaultStyleProjectName,
          },
          workspaceTree,
        )
        .toPromise();

      expect(workspaceTree.exists('tsconfig.eslint.json')).toBe(true);

      expect(workspaceTree.get('tsconfig.eslint.json')!.content.toString())
        .toMatchInlineSnapshot(`
        "{
          \\"extends\\": \\"./tsconfig.base.json\\",
          \\"compilerOptions\\": {
            \\"noEmit\\": true
          },
          \\"include\\": [\\"src\\", \\"e2e\\"]
        }
        "
      `);
    });

    it('should add a target called `eslint` to the angular.json config for the given project', async () => {
      await schematicRunner
        .runSchematicAsync<Schema>(
          'add-config-to-project',
          {
            project: testDefaultStyleProjectName,
          },
          workspaceTree,
        )
        .toPromise();

      const angularJSON = JSON.parse(
        workspaceTree.get('angular.json')!.content.toString(),
      );

      expect(
        angularJSON.projects[testDefaultStyleProjectName].architect.eslint,
      ).toBeTruthy();

      expect(angularJSON.projects[testDefaultStyleProjectName].architect.eslint)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@angular-eslint/builder:lint",
          "options": Object {
            "exclude": Array [
              "**/node_modules/**",
            ],
            "lintFilePatterns": Array [
              "src/**/*.ts",
              "src/**/*.component.html",
            ],
          },
        }
      `);
    });
  });

  describe('additional project (e.g. within projects/ directory)', () => {
    it('should throw if there is no existing ESLint configuration at the root of the workspace', async () => {
      await expect(
        schematicRunner
          .runSchematicAsync<Schema>(
            'add-config-to-project',
            {
              project: testProjectName,
            },
            workspaceTree,
          )
          .toPromise(),
      ).rejects.toThrow(
        'Could not find a `.eslintrc.json` or `.eslintrc.js` file at the root of your project. Please create one before running this schematic on an individual project',
      );
    });

    describe('root config is `.eslintrc.json`', () => {
      it('should create an `.eslintrc.json` file in the root of the given project', async () => {
        // Supports using `.eslintrc.json` at the root of the workspace
        workspaceTree.create('.eslintrc.json', JSON.stringify({}));

        await schematicRunner
          .runSchematicAsync<Schema>(
            'add-config-to-project',
            {
              project: testProjectName,
            },
            workspaceTree,
          )
          .toPromise();

        expect(workspaceTree.exists('projects/foo/.eslintrc.json')).toBe(true);

        expect(
          workspaceTree.get('projects/foo/.eslintrc.json')!.content.toString(),
        ).toMatchInlineSnapshot(`
          "{
            \\"extends\\": [\\"../../.eslintrc.json\\"],
            \\"parserOptions\\": {
              \\"project\\": \\"projects/foo/tsconfig.eslint.json\\"
            },
            \\"rules\\": {}
          }
          "
        `);
      });
    });

    describe('root config is `.eslintrc.js`', () => {
      it('should create an `.eslintrc.json` file in the root of the given project', async () => {
        // Supports using `.eslintrc.js` at the root of the workspace
        workspaceTree.create('.eslintrc.js', JSON.stringify({}));

        await schematicRunner
          .runSchematicAsync<Schema>(
            'add-config-to-project',
            {
              project: testProjectName,
            },
            workspaceTree,
          )
          .toPromise();

        expect(workspaceTree.exists('projects/foo/.eslintrc.json')).toBe(true);

        expect(
          workspaceTree.get('projects/foo/.eslintrc.json')!.content.toString(),
        ).toMatchInlineSnapshot(`
                  "{
                    \\"extends\\": [\\"../../.eslintrc.js\\"],
                    \\"parserOptions\\": {
                      \\"project\\": \\"projects/foo/tsconfig.eslint.json\\"
                    },
                    \\"rules\\": {}
                  }
                  "
              `);
      });
    });

    it('should create a `tsconfig.eslint.json` file in the root of the given project', async () => {
      workspaceTree.create('.eslintrc.json', JSON.stringify({}));

      await schematicRunner
        .runSchematicAsync<Schema>(
          'add-config-to-project',
          {
            project: testProjectName,
          },
          workspaceTree,
        )
        .toPromise();

      expect(workspaceTree.exists('projects/foo/tsconfig.eslint.json')).toBe(
        true,
      );

      expect(
        workspaceTree
          .get('projects/foo/tsconfig.eslint.json')!
          .content.toString(),
      ).toMatchInlineSnapshot(`
        "{
          \\"extends\\": \\"../../tsconfig.base.json\\",
          \\"compilerOptions\\": {
            \\"noEmit\\": true
          },
          \\"include\\": [\\"src\\", \\"e2e\\"]
        }
        "
      `);
    });

    it('should add a target called `eslint` to the angular.json config for the given project', async () => {
      workspaceTree.create('.eslintrc.json', JSON.stringify({}));

      await schematicRunner
        .runSchematicAsync<Schema>(
          'add-config-to-project',
          {
            project: testProjectName,
          },
          workspaceTree,
        )
        .toPromise();

      const angularJSON = JSON.parse(
        workspaceTree.get('angular.json')!.content.toString(),
      );

      expect(
        angularJSON.projects[testProjectName].architect.eslint,
      ).toBeTruthy();

      expect(angularJSON.projects[testProjectName].architect.eslint)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@angular-eslint/builder:lint",
          "options": Object {
            "exclude": Array [
              "**/node_modules/**",
            ],
            "lintFilePatterns": Array [
              "projects/foo/**/*.ts",
              "projects/foo/**/*.component.html",
            ],
          },
        }
      `);
    });
  });
});
