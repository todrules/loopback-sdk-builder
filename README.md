LoopBack SDK Builder 
==================


The [@mean-expert/loopback-sdk-builder](https://www.npmjs.com/package/@mean-expert/loopback-sdk-builder) is a community driven module forked from the official `loopback-sdk-angular` and refactored to support [Angular 2](http://angular.io).

The [LoopBack SDK Builder](https://www.npmjs.com/package/@mean-expert/loopback-sdk-builder) will explore your [LoopBack Application](http://loopback.io) and will automatically build everything you need to start writing your [Angular 2 Applications](http://angular.io) right away. From Interfaces and Models to API Services and Real-time communications.

# Installation

````sh
$ cd to/loopback/project
$ npm install --save-dev @mean-expert/loopback-sdk-builder
````

# Documentation

[LINK TO WIKI DOCUMENTATION](https://github.com/mean-expert-official/loopback-sdk-builder/wiki)

# Features

[LINK TO FEATURES](https://github.com/mean-expert-official/loopback-sdk-builder/wiki#features)

![LoopBack SDK Builder](https://storage.googleapis.com/mean-expert-images/sdk-builder.jpg)

##Installation

The [@mean-expert/loopback-sdk-builder] should be installed using NPM as follows:

````sh
$ cd to/loopback/project
$ npm install --save @mean-expert/{loopback-component-realtime,loopback-sdk-builder}
````

##SDK Builder CLI Tool

````text
$ cd to/loopback/project
$ ./node_modules/.bin/lb-sdk

******************************************* LoopBack SDK Builder 2.0 *******************************************

Generate Client SDK for your LoopBack Application.
Usage:
 ./node_modules/.bin/lb-sdk server/server path/to/sdk -d [ng4web | nativescript2] -i [enabled | disabled]

Options:
  -l, --library  Client's library (angular2, react <todo>, ...)                          [default: "angular2"]
  -d, --driver   Platform specific drivers (ng4web, nativescript2, ng2universal <todo>)  [default: "ng4web"]
  -i, --io       Enable PubSub, IO and FireLoop functionality                            [default: "enabled"]
````

##IMPORTANT WARNING

The [@mean-expert/loopback-sdk-builder] will wipe everything inside the `path/to/sdk` directory you define, please make sure you always point to `app/shared/sdk` and not to other critical directories where you don't want to lose any information.

##Generate Angular 2 SDK for Web and Progressive Apps

The default options will create an Angular 2 SDK for Web.

```sh
$ ./node_modules/.bin/lb-sdk server/server.js /path/to/client/sdk
```

Is equivalent to

```sh
$ ./node_modules/.bin/lb-sdk server/server.js /path/to/client/sdk -l angular2 -d ng4web -i disabled
```


##Recomended Use

Add a script within package.json

```json
{
  "scripts": {
    "build:sdk": "./node_modules/.bin/lb-sdk server/server path/to/ng2-app/src/app/shared/sdk -d [ng4web | nativescript2] -i [enabled | disabled]"
  }
}
```

#### then:

```sh
$ cd to/loopback/project
$ npm run build:sdk
```

[@mean-expert/loopback-sdk-builder]: http://npmjs.com/package/@mean-expert/loopback-sdk-builder
