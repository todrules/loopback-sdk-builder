exports.describeModels = function describeModels(app) {
	
	let models = {};
  
  app.handler('rest').adapter.getClasses().forEach(function (c) {
	
		let name = capitalize(c.name);
    
    c.description = c.sharedClass.ctor.settings.description;
	
		// Tell SDK Builder to generate model by default, unless user
    c.sharedClass.ctor.settings = Object.assign(
      {},
      c.sharedClass.ctor.settings,
      { sdk: { enabled: true }}
    );
	
		// Tell SDK to blacklist specific methods
    c.sharedClass.ctor.settings.sdk.blacklist = Object.assign(
			{},
      c.sharedClass.ctor.settings.sdk.blacklist || {}
    );
    if (!c.ctor) {

      console.error('Skipping %j as it is not a LoopBack model', name);
      return;
    }

    c.methods.forEach(function fixArgsOfPrototypeMethods(method, key) {
	
			// Fix for REST DataSource with invalid param configuration
      if (method.name === 'invoke' && method.sharedMethod.isStatic) {
        method.accepts.forEach((param) => {
          if (!param.arg && param.name) {
            param.arg = param.name;
            param.http = { source: 'body' };
          }
        });
      }
	
			// Add CreateMany Support
      if (method.name.match(/(^createMany)/)) return
      if (method.name.match(/(^create$|__create__)/)) {
				let createMany = Object.create(method);
        createMany.name = method.name.replace(/create/g, 'createMany');
        createMany.isReturningArray = function () { return true; };
        c.methods.push(createMany);
      }
	
			let ctor = method.restClass.ctor;
      if (!ctor || method.sharedMethod.isStatic) return;
      method.accepts = ctor.accepts.concat(method.accepts);
			let loaded = {};
      // Clean duplicated params from diff sources
      if (method.name.match(/createMany/)) {
        method.accepts.forEach((param, index, arr) => {
          if (loaded[param.arg]) {
            arr.splice(index, 1);
          } else  {
            loaded[param.arg] = true;
          }
        });
      }
	
			if (!method.accepts) return;
	
			// Any extra http action arguments in the path need to be added to the
      // angular resource actions as params
      method.accepts.forEach(function findResourceParams(arg) {
        if (!arg.http) return;

        if (arg.http.source === 'path' && arg.arg !== 'id') {
          if (!method.resourceParams) {
            method.resourceParams = [];
            method.hasResourceParams = true;
          }
          method.resourceParams.push(arg);
        }
      });
    });

    c.properties = c.sharedClass.ctor.definition.properties;

    c.isUser = c.sharedClass.ctor.prototype instanceof app.loopback.User ||
      c.sharedClass.ctor.prototype === app.loopback.User.prototype;
    models[name] = c;
  });

  buildScopes(models);

  return models;
};

let SCOPE_METHOD_REGEX = /^prototype.__([^_]+)__(.+)$/;

function buildScopes(models) {
	for (let modelName in models) {
    buildScopesOfModel(models, modelName);
  }
}

function buildScopesOfModel(models, modelName) {
	let modelClass = models[ modelName ];

  modelClass.scopes = {};
  modelClass.methods.forEach(function (method) {
    buildScopeMethod(models, modelName, method);
  });

  return modelClass;
}

// reverse-engineer scope method
// defined by loopback-datasource-juggler/lib/scope.js
function buildScopeMethod(models, modelName, method) {
	let modelClass = models[ modelName ];
	let match = method.name.match(SCOPE_METHOD_REGEX);
  if (!match) return;
	
	let op = match[ 1 ];
	let scopeName = match[ 2 ];
	let modelPrototype = modelClass.sharedClass.ctor.prototype;
	let targetClass = modelPrototype[ scopeName ] &&
    modelPrototype[scopeName]._targetClass;
  if (modelClass.scopes[scopeName] === undefined) {
    if (!targetClass) {
      console.error(
        'Warning: scope %s.%s is missing _targetClass property.' +
        '\nThe Angular code for this scope won\'t be generated.' +
        '\nPlease upgrade to the latest version of' +
        '\nloopback-datasource-juggler to fix the problem.',
        modelName, scopeName);
      modelClass.scopes[scopeName] = null;
      return;
    }

    if (!findModelByName(models, targetClass)) {
      console.error(
        'Warning: scope %s.%s targets class %j, which is not exposed ' +
        '\nvia remoting. The Angular code for this scope won\'t be generated.',
        modelName, scopeName, targetClass);
      modelClass.scopes[scopeName] = null;
      return;
    }

    modelClass.scopes[scopeName] = {
      methods: {},
      targetClass: targetClass
    };
  } else if (modelClass.scopes[scopeName] === null) {
    // Skip the scope, the warning was already reported
    return;
  }
	
	let apiName = scopeName;
  if (op == 'get') {
    // no-op, create the scope accessor
  } else if (op == 'delete') {
    apiName += '.destroyAll';
  } else {
    apiName += '.' + op;
  }

  modelClass.sharedClass.ctor.relations[scopeName].targetClass = capitalize(targetClass);
}

function findModelByName(models, name) {
	for (let n in models) {
    if (n.toLowerCase() == name.toLowerCase())
      return models[n];
  }
}

function capitalize(string) {
  return string[0].toUpperCase() + string.slice(1);
}
