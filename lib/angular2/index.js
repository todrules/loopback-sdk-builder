var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var rmdir = require('rimraf');
var ejs = require('ejs');
var utils = require('../utils');
let chalk = require('chalk');
/**
 * EJS Q Filter
 */
ejs.filters.q = (obj) => JSON.stringify(obj, null, 2);
/**
 * Generate Client SDK for the given loopback application.
 */
module.exports = function generate(ctx) {
  'use strict';
  // Describe models and remove those blacklisted
  ctx.models = utils.describeModels(ctx.app);
  /**
   * Directory Management
   */
  ctx.outputFolder = path.resolve(ctx.outputFolder);
	ctx.modelDir = path.resolve(ctx.modelDir);
	ctx.servicesDir = path.resolve(ctx.servicesDir);
	ctx.apiDir = path.resolve(ctx.apiDir);
	console.log('Removing directory %s', ctx.outputFolder);
  rmdir.sync(ctx.outputFolder);
	console.log(chalk.yellow('Removing directory %s', ctx.modelDir));
	rmdir.sync(ctx.modelDir);
	console.log(chalk.yellow('Removing directory %s', ctx.servicesDir));
	rmdir.sync(ctx.servicesDir);
	console.log(chalk.yellow('Removing directory %s', ctx.apiDir));
	rmdir.sync(ctx.apiDir);

  // Create required directories
  let directories = [
		ctx.outputFolder,
		ctx.modelDir,
		ctx.servicesDir,
		ctx.apiDir
  ];

  directories.forEach(directory => mkdirp.sync(directory));
  /**
   * Fix to decide which AcccessToken to get, since usually is private, but not
   * Always, so  we need to import from the right place
   */
	ctx.loadAccessToken = false;
  /**
	 * LoopBack SDK Builder Schema for Angular 2 and NativeScript 2
  **/
  let schema = [
    /**
     * SDK INDEXES
     */
    {
			template: './api.module.ejs',
			output: ctx.apiDir + '/api.module.ts',
      params: {
				models: ctx.models,
				buildModuleImports: buildModuleImports
      }
    },
    {
			template: './model.module.ejs',
			output: ctx.modelDir + '/model.module.ts',
      params: {
				models: ctx.models,
				buildModModImports: buildModModImports
      }
    },
    /**
     * SDK STATIC BASE AND CORE FILES
     */
    {
			template: './models/base.ejs',
			output: ctx.modelDir + '/base.model.ts',
      params: { loadAccessToken: ctx.loadAccessToken }
    },
    {
			template: './services/base.ejs',
			output: ctx.apiDir + '/base.api.ts',
      params: {
				buildBaseServiceImports: buildBaseServiceImports
      }
    },
    {
			template: './services/error.ejs',
			output: ctx.servicesDir + '/exception.service.ts',
      params: {}
    },
    {
			template: './services/search.ejs',
			output: ctx.servicesDir + '/json.service.ts',
      params: {}
    },
  ];

  /**
   * SDK DYNAMIC FILES
   */
  Object.keys(ctx.models).forEach(modelName => {
    if (ctx.models[modelName].sharedClass.ctor.settings.sdk &&
      !ctx.models[modelName].sharedClass.ctor.settings.sdk.enabled) {
      console.warn('LoopBack SDK Builder: %s model was ignored', modelName);
      return;
    } else {
			let lcase = modelName.toLowerCase();
      console.info('LoopBack SDK Builder: adding %s model to SDK', modelName);
			schema = schema.concat([
        /**
        * SDK MODELS
        */
        {
					template: './models/model.ejs',
					output: ctx.modelDir + '/' + lcase + '.model.ts',
          params: {
            model: ctx.models[modelName],
            modelName: modelName,
            buildModelImports: buildModelImports,
						buildModelProperties: buildModelProperties
          }
				},
				/**
				 * SDK CUSTOM SERVICES
				 */
				{
					template: './services/service.ejs',
					output: ctx.apiDir + '/' + lcase + '.api.ts',
          params: {
            model: ctx.models[modelName],
            modelName: modelName,
            moduleName: ctx.moduleName,
						buildPostBody: buildPostBody,
						buildUrlParams: buildUrlParams,
						buildRouteParams: buildRouteParams,
            loadAccessToken: ctx.loadAccessToken,
						buildMethodParams: buildMethodParams,
						buildServiceImports: buildServiceImports,
						normalizeMethodName: normalizeMethodName,
						buildObservableType: buildObservableType,
						paramIsContext: paramIsContext
          }
				}
			]);
    }
  });
  /**
   * PROCESS SCHEMA
   */
  schema.forEach(
    config => {
      console.info('Generating: %s', `${ctx.outputFolder}${config.output}`);
      fs.writeFileSync(
				`${config.output}`,
        ejs.render(fs.readFileSync(
          require.resolve(config.template),
          { encoding: 'utf-8' }),
          config.params
        )
      )
    }
  );
  /**
   * @method buildModelImports
   * @description
   * Define import statement for those model who are related to other scopes
   */
  function buildModelImports(model) {
    let relations = getModelRelations(model);
    let loaded = {};
    let output = [];
		let imports = [];
    if (relations.length > 0) {
      relations.forEach((relationName, i) => {
        let targetClass = model.sharedClass.ctor.relations[relationName].targetClass;
        if (!loaded[targetClass]) {
          loaded[targetClass] = true;
          output.push(`  ${targetClass}`);
        }
      });
    }
	
		if(output.length > 0) {
		
			output.forEach(modelName => {
				let name = capitalize(modelName.trim());
				let lcase = name.toLowerCase();
			
				imports.push({ module: name, from: './' + lcase + '.model' });
			});

    }
		return buildImports(imports);
  }
  /**
   * @method buildModelProperties
   * @description
   * Define properties for the given model
   */
  function buildModelProperties(model, isInterface) {
    let output = [];
    // Add Model Properties
    Object.keys(model.properties).forEach((property) => {
      if (model.isUser && property === 'credentials') return;
      let meta = model.properties[property];
      let isOptional = isInterface && !meta.required ? '?' : '';
			output.push(`  ${property}${isOptional}: ${buildPropertyType(meta.type)};`);
    });
    // Add Model Relations
    Object.keys(model.sharedClass.ctor.relations).forEach(relation => {
			output.push(`  ${relation}${isInterface ? '?' : ''}: ${buildRelationType(model, relation)};`);
    });
    return output.join('\n');
  }
  /**
   * @method buildRelationType
   * @description
   * Discovers property type according related models that are public
   */
  function buildRelationType(model, relationName) {
    let relation = model.sharedClass.ctor.relations[relationName];
    let targetClass = relation.targetClass;
    let basicType = (ctx.models[targetClass]) ? targetClass : 'any';
    let finalType = relation.type.match(/(hasOne|belongsTo)/g)
      ? basicType : `Array<${basicType}>`;
    return finalType;
  }
  /**
   * @method buildObservableType
   * @description
   * Define observable type
   */
  function buildObservableType(modelName, methodName) {
    let type = 'any';
    if (methodName.match(/(^createMany$|^find)/g)) type = `Array<${modelName}>`;
    if (methodName.match(/(^create$|upsert|^findBy|^findOne$)/g)) type = modelName;
    return type;
  }
  /**
   * @method buildServiceImports
   * @description
   * Define import statement for those model who are related to other scopes
   * IMPORTANT: This method have a very specific flow, changing it may create
   * multiple issues on multiple different use cases.
   */
  function buildServiceImports(model, loadAccessToken) {
    let modelName = capitalize(model.name);
	
		let lcase = modelName.toLowerCase();
    
    let imports = [
			{ module: 'Injectable', from: '@angular/core' },
			{ module: 'Http, Headers, Request, Response', from: '@angular/http' },
			{ module: 'BaseApi', from: './base.api' },
      {
				module: `LoopBackFilter`, from: '../models/base.model'
      },
			{ module: 'JSONService', from: '../services/generated/json.service' },
			{ module: 'ExceptionHandler', from: '../services/generated/exception.service' },
			{ module: 'AuthGuardService', from: '../modules/auth/auth-guard.service' },
			{ module: 'API_BASE_URL', from: '../config/environment' },
			{ module: 'AuthService', from: '../modules/auth/auth.service' },
      { module: 'Subject', from: 'rxjs/Subject'},
      { module: 'Observable', from: 'rxjs/Observable'},
      { module: 'rxjs/add/operator/map' },
			{ module: modelName, from: `../models/${lcase}.model` },
    ];
    let loaded = {}; loaded[model.name] = true;
    getModelRelations(model).forEach((relationName, i) => {
      let targetClass = model.sharedClass.ctor.relations[relationName].targetClass;
      if (
        model.sharedClass.ctor.relations[relationName].modelThrough &&
        model.sharedClass.ctor.relations[relationName].modelThrough.sharedClass.name !== 'Model' &&
        ctx.models[model.sharedClass.ctor.relations[relationName].modelThrough.sharedClass.name]
      ) {
        let through = capitalize(model.sharedClass.ctor.relations[relationName].modelThrough.sharedClass.name);
				let lcase = through.toLowerCase();
        if (!loaded[through]) {
          loaded[through] = true;
					imports.push({ module: through, from: `../models/${lcase}.model` });
        }
      }
      // Now and after the through model was included is the right time to verify if the current model
      // was loaded by another relationship, this way we don't duplicate the class during imports'
      if (!loaded[targetClass]) {
        loaded[targetClass] = true;
				let tg = targetClass.toLowerCase();
				imports.push({ module: targetClass, from: `../models/${tg}.model` });
      }
    });

    return buildImports(imports);
  }
  /**
   * @method buildModuleImports
   * @description
   * Define import statement for the SDK Module
   */
	function buildModuleImports(models) {
    let imports = [
			{ module: 'NgModule, ModuleWithProviders', from: '@angular/core' },
			{ module: 'CommonModule', from: '@angular/common' },
      { module: 'HttpModule', from: '@angular/http'},
			{ module: 'JSONService', from: '../services/generated/json.service' },
			{ module: 'ExceptionHandler', from: '../services/generated/exception.service' }
		];
	
		Object.keys(models).forEach(modelName => {
			let name = capitalize(modelName);
			let lcase = name.toLowerCase();
			imports.push({ module: `${name}Api`, from: `./${lcase}.api` });
		});
	
		return buildImports(imports);
	}
	
	function buildModModImports(models) {
		let imports = [
			{ module: 'NgModule', from: '@angular/core' },
      { module: 'CommonModule', from: '@angular/common'},
		
		];

    Object.keys(models).forEach(modelName => {
      let name = capitalize(modelName);
			let lcase = name.toLowerCase();
			imports.push({ module: `${name}`, from: `./${lcase}.model` });
    });

    return buildImports(imports);
  }
  /**
   * @method buildBaseServiceImports
   * @description
   * Define import statement for the SDK Module
   */
	function buildBaseServiceImports() {
    let imports = [
			{ module: 'Injectable', from: '@angular/core' },
      { module: 'Http, Headers, Request', from: '@angular/http'},
			{ module: 'JSONService', from: '../services/generated/json.service' },
			{ module: 'AuthGuardService', from: '../modules/auth/auth-guard.service' },
			{ module: 'API_BASE_URL', from: '../config/environment' },
			{ module: 'AuthService', from: '../modules/auth/auth.service' },
			{ module: 'ExceptionHandler', from: '../services/generated/exception.service' },
      { module: 'Observable', from: 'rxjs/Observable' },
      { module: 'ErrorObservable', from: 'rxjs/observable/ErrorObservable' },
      { module: 'rxjs/add/operator/catch' },
      { module: 'rxjs/add/operator/map' },
    ];

    return buildImports(imports);
  }
  /**
   * @method buildImports
   * @description
   * Transform an array of objects describing which should be imported into
   * the actual template strings
   */
  function buildImports(imports) {
    return imports.map(item =>
      `import ${(item.from ? `{ ${item.module} }` : `'${item.module}'`)}${(item.from ? ` from '${item.from}'` : '')};`
    ).join('\n');
  }
  /**
   * @method normalizeMethodName
   * @description
   * Normalizes method name from loopback form to a more human readable form
   */
  function normalizeMethodName(methodName, capitalize) {
    return methodName.split('__').map((value, index) => {
      return (index < 2 && !capitalize) ? value : (value.charAt(0).toUpperCase() + value.slice(1));
    }).join('');
  }
  /**
   * @method buildMethodParams
   * @description
   * Set which params should be defined for the given remote method
   */
	function buildMethodParams(model, methodName, params) {
    if (methodName === 'logout') return '';
    let output = new Array();
    let relations = getModelRelations(model);
    let availableClasses = relations.map((relationName, index) =>
      model.sharedClass.ctor.relations[relationName].targetClass
    );

    params = params.filter(param => {
      return !paramIsContext(param)
    });

    relations.forEach(relationName => {
        if (model.sharedClass.ctor.relations[relationName].modelThrough) {
          let throughName = capitalize(
            model.sharedClass.ctor.relations[relationName].modelThrough.sharedClass.name
          );
          // Only add through models when they are Public
          if (ctx.models[throughName]) {
            availableClasses.push(capitalize(
              model.sharedClass.ctor.relations[relationName].modelThrough.sharedClass.name
            ));
          }
        }
      }
    );

    params.forEach((param, i, arr) => {
      let type;
      if (param.type === 'object') {
        type = param.arg === 'filter' ? 'LoopBackFilter' : 'any';
      } else {
        type = param.type !== 'AccessToken' && param.type !== 'any'
          ? capitalize(param.type) : 'any';
      }
      if (!type.match(/(^any$|LoopBackFilter)/) && availableClasses.indexOf(type) < 0) {
        type = 'any';
      }
      let value = '';
      // Accept Array on createMany method.
      if (methodName.match(/createMany/) && param.arg === 'data') {
        type = `Array<${type}>`;
      }
	
			value = !param.required ? ` = ${ type.match(/Array/) ? '[]' : '{}' }` : '';
      output.push(`${param.arg}: ${type}${value}`);
    });

    return output.join(', ');
  }
  /**
   * @method paramIsRoute
   * @description
   * Testing if the param is route type
   */
  function paramIsRoute(param) {
    return (param.http && param.http.source === 'path') || (param.arg && param.arg.match(/(^id$|fk|file|container)/));
  }
  /**
   * @method paramIsFunction
   * @description
   * Testing if the param is function type
   */
  function paramIsFunction(param) {
    return typeof param.http === 'function'
  }
  /**
   * @method paramIsContext
   * @description
   * Testing if the param is a http.context
   */
  function paramIsContext(param) {
    return (typeof param.http !== 'undefined' && typeof param.http.source !== 'undefined' && param.http.source === 'context');
  }
  /**
   * @method buildPostBody
   * @description
   * Define which properties should be passed while posting data (POST, PUT, PATCH)
   */
  function buildPostBody(postData) {
    let output = [];
    if (Array.isArray(postData)) {
      postData = postData.filter(param => {
        // Filter out route params and function params
        if (paramIsRoute(param) || paramIsFunction(param)) {
          return false
        }
        // Make sure the param is body
        return param.http && param.http.source == 'body'
      })
      if (postData.length > 0) {
        output.push('');
        let l = postData.length;
        postData.forEach((property, i) => {
          output.push(`      ${property.arg}: ${property.arg}${(i < l - 1) ? ',' : ''}`);
        });
        output.push('    ');
      }
    }
    return output.join('\n');
  }
  /**
   * @method buildUrlParams
   * @description
   * Define which properties should be passed using query string
   */
  function buildUrlParams(model, methodName, urlParams) {
    let output = [''];
    // filter params that should not go over url query string
    urlParams = urlParams.filter(param => {
        // Filter out route params and function params
        if (paramIsRoute(param) || paramIsFunction(param) || paramIsContext(param)) {
          return false
        }
        // Filter out body params
        return (!param.http || param.http.source != 'body')
    });
    if (model.isUser && methodName === 'logout')
      output.push(`       _urlParams.access_token = this.auth.getAccessTokenId();`);
    if (urlParams && urlParams.length > 0) {
      urlParams.forEach((param, i) => {
        output.push(`    if (${param.arg}) _urlParams.${param.arg} = ${param.arg};`);
      });
    }
    return output.join('\n');
  }
  /**
   * @method buildRouteParams
   * @description
   * Define which properties should be passed as route params
   */
  function buildRouteParams(routeParams) {
    let output = [];
    if (routeParams) {
      routeParams = routeParams.filter(paramIsRoute)
      if (routeParams.length > 0) {
        output.push('');
        routeParams.forEach((param, i) => {
          output.push(`      ${param.arg}: ${param.arg}${(i < routeParams.length - 1) ? ',' : ''}`);
        });
        output.push('    ');
      }
    }
    return output.join('\n');
  }
  /**
   * @author João Ribeiro <jonnybgod@gmail.com, http://jonnybgod.ghost.io>,
	 * @license MTI
   * @method buildPropertyType
   * @description
   * Define which properties should be passed as route params
   */
  function buildPropertyType(type) {
    switch (typeof type) {
      case 'function':
        switch(type.name) {
          case 'String':
          case 'Number':
          case 'Boolean':
            return type.name.toLowerCase();
          case 'Date':
          case 'GeoPoint':
            return type.name;
          default:
            return 'any';
        }
      case 'object':
        if(Array.isArray(type)) {
            return `Array<${buildPropertyType(type[0])}>`
        }
        return 'object';
      default:
        return 'any';
    }
  }
};
/**
 * HELPERS
 */
function capitalize(string) {
  return string[0].toUpperCase() + string.slice(1);
}

function getModelRelations(model) {
  return Object.keys(model.sharedClass.ctor.relations).filter(relationName =>
      model.sharedClass.ctor.relations[relationName].targetClass &&
      model.sharedClass.ctor.relations[relationName].targetClass !== model.name
  );
}
