'use strict';

var Q = require('q');
var gulpUtil = require('gulp-util');
var jetpack = require('fs-jetpack');
var asar = require('asar');
var utils = require('./utils');

var projectDir;
var releasesDir;
var tmpDir;
var finalAppDir;
var manifest;

var init = function () {
  projectDir = jetpack;
  tmpDir = projectDir.dir('./tmp', { empty: true });
  releasesDir = projectDir.dir('./releases');
  manifest = projectDir.read('app/package.json', 'json');
  finalAppDir = tmpDir.cwd(manifest.productName + '.app');
  return Q();
};

var copyRuntime = function () {
  return projectDir.copy('node_modules/electron/dist/Electron.app',
                              finalAppDir.path());
};

var cleanupRuntime = function() {
  finalAppDir.remove('Contents/Resources/default_app');
  finalAppDir.remove('Contents/Resources/atom.icns');
  return Q();
}

var packageBuiltApp = function () {
  var deferred = Q.defer();

  asar.createPackage(
    projectDir.path('build'),
    finalAppDir.path('Contents/Resources/app.asar'),
    function() {
      deferred.resolve();
    }
  );

  return deferred.promise;
};

var finalize = function () {
  // Prepare main Info.plist
  var info = projectDir.read('resources/osx/Info.plist');
  info = utils.replace(info, {
      productName: manifest.productName,
      identifier: manifest.identifier,
      version: manifest.version
  });
  finalAppDir.write('Contents/Info.plist', info);

  // Prepare Info.plist of Helper apps
  [' EH', ' NP', ''].forEach(function (helper_suffix) {
      info = projectDir.read(
        'resources/osx/helper_apps/Info' + helper_suffix + '.plist'
      );
      info = utils.replace(info, {
          productName: manifest.productName,
          identifier: manifest.identifier
      });
      finalAppDir.write(
        'Contents/Frameworks/Electron Helper' + helper_suffix +
          '.app/Contents/Info.plist',
        info
      );
  });

  // Copy icon
  projectDir.copy('resources/osx/icon.icns',
                  finalAppDir.path('Contents/Resources/icon.icns'));

  return Q();
};

var renameApp = function() {

  // Rename application
  finalAppDir.rename('Contents/MacOS/Electron', manifest.productName);
  return Q();
}

var packToDmgFile = function () {
  var deferred = Q.defer();
  var appdmg = require('appdmg');
  var dmgName = 'xcore-gui.osx64.dmg';

  // Prepare appdmg config
  var dmgManifest = projectDir.read('resources/osx/appdmg.json');
  dmgManifest = utils.replace(dmgManifest, {
    productName: manifest.productName,
    appPath: finalAppDir.path(),
    dmgIcon: projectDir.path("resources/osx/dmg-icon.icns"),
    dmgBackground: projectDir.path("resources/osx/dmg-background.png")
  });
  tmpDir.write('appdmg.json', dmgManifest);

  // Delete DMG file with this name if already exists
  releasesDir.remove(dmgName);
  gulpUtil.log('Packaging to DMG file...');

  var readyDmgPath = releasesDir.path(dmgName);

  appdmg({
    source: tmpDir.path('appdmg.json'),
    target: readyDmgPath
  })
  .on('error', function (err) {
    console.error(err);
  })
  .on('finish', function () {
    gulpUtil.log('DMG file ready!', readyDmgPath);
    deferred.resolve();
  });

  return deferred.promise;
};

var cleanClutter = function () {
  return tmpDir.remove('.');
};

module.exports = function () {
  return init()
    .then(copyRuntime)
    .then(cleanupRuntime)
    .then(packageBuiltApp)
    .then(finalize)
    .then(renameApp)
    .then(packToDmgFile)
    .then(cleanClutter).catch(err => { console.log(err); });
};
