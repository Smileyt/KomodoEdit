/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 * 
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is Komodo code.
 * 
 * The Initial Developer of the Original Code is ActiveState Software Inc.
 * Portions created by ActiveState Software Inc are Copyright (C) 2000-2007
 * ActiveState Software Inc. All Rights Reserved.
 * 
 * Contributor(s):
 *   ActiveState Software Inc
 * 
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */

//---- globals
var _findingInterps = false;
var prefExecutable = null;
var programmingLanguage = "Python";
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
            .getService(Components.interfaces.nsIStringBundleService)
            .createBundle("chrome://komodo/locale/pref/pref-languages.properties");
//---- functions

function OnPreferencePageOK(prefset)
{
    return checkValidInterpreterSetting(prefset,
                                        "pythonDefaultInterpreter",
                                        programmingLanguage);
}

// Populate the (tree) list of available Python interpreters on the current
// system.
function prefPython_PopulatePythonInterps()
{
    var availInterpList = document.getElementById("pythonDefaultInterpreter");
    var infoSvc = Components.classes["@activestate.com/koInfoService;1"].
                      getService(Components.interfaces.koIInfoService);

    // remove any existing items and add a "finding..." one
    _findingInterps = true;
    availInterpList.removeAllItems();
    availInterpList.appendItem(_bundle.formatStringFromName("findingInterpreters.label", [programmingLanguage], 1));

    // get a list of installed Python interpreters
    var sysUtils = Components.classes['@activestate.com/koSysUtils;1'].
        getService(Components.interfaces.koISysUtils);
    var availInterps = [];
    availInterps = sysUtils.WhichAll("python", {});
    if (infoSvc.platform == 'darwin') {
        availInterps = availInterps.concat(sysUtils.WhichAll("pythonw", {}));
    }

    availInterpList.removeAllItems();
    availInterpList.appendItem(_bundle.GetStringFromName("findOnPath.label"),'');

    var found = false;
    // populate the tree listing them
    if (availInterps.length === 0) {
        // tell the user no interpreter was found and direct them to
        // ActiveState to get one
        document.getElementById("no-avail-interps-message").removeAttribute("collapsed");
    } else {
        for (var i = 0; i < availInterps.length; i++) {
            availInterpList.appendItem(availInterps[i],availInterps[i]);
            if (availInterps[i] == prefExecutable) {
                found = true;
            }
        }
    }
    if (!found && prefExecutable) {
        availInterpList.appendItem(prefExecutable,prefExecutable);
    }
    _findingInterps = false;
}


function PrefPython_OnLoad()
{
    if (parent.hPrefWindow.prefset.hasStringPref('pythonDefaultInterpreter') &&
        parent.hPrefWindow.prefset.getStringPref('pythonDefaultInterpreter')) {
        prefExecutable = parent.hPrefWindow.prefset.getStringPref('pythonDefaultInterpreter');
    } else {
        prefExecutable = '';
    }
    prefPython_PopulatePythonInterps();
    parent.hPrefWindow.onpageload();
}

var havePylint = {};

function OnPreferencePageLoading() {
    var origWindow = ko.windowManager.getMainWindow();
    var extraPaths = document.getElementById("pythonExtraPaths");
    var cwd = origWindow.ko.window.getCwd();
    extraPaths.setCwd(cwd);
    extraPaths.init(); // must happen after onpageload
    updateUI_part1();
}

function updateUI_part1() {
    var currentPythonInterpreter = document.getElementById("pythonDefaultInterpreter").value;
    if (!currentPythonInterpreter) {
        updateUI_part3(currentPythonInterpreter);
    } else if (!(currentPythonInterpreter in havePylint)) {
        setTimeout(function() {
                var cmd = currentPythonInterpreter + " -c 'import pylint'";
                var runSvc = Components.classes["@activestate.com/koRunService;1"].getService(Components.interfaces.koIRunService);
                var output = {}, errors = {};
                var res = runSvc.RunAndCaptureOutput(cmd, null, null, null,
                                                     output, errors);
                res = res == 1 ? false : true;
                havePylint[currentPythonInterpreter] = res;
                updateUI_part2(currentPythonInterpreter);
            }, 300);
    } else {
        updateUI_part2(currentPythonInterpreter);
    }
}

function updateUI_part2(currentPythonInterpreter) {
    // Update UI for pylint
    var checkbox = document.getElementById("lint_python_with_pylint");
    var failureNode = document.getElementById("pylint_failure");
    if (currentPythonInterpreter && havePylint[currentPythonInterpreter]) {
        failureNode.setAttribute("class", "pref_hide");
        checkbox.disabled = false;
    } else {
        checkbox.checked = false;
        checkbox.disabled = true;
        if (!currentPythonInterpreter) {
            failureNode.setAttribute("class", "pref_hide");
        } else {
            var text = _bundle.formatStringFromName("The current Python instance X doesnt have pylint installed", [currentPythonInterpreter], 1);
            var textNode = document.createTextNode(text);
            while (failureNode.firstChild) {
                failureNode.removeChild(failureNode.firstChild);
            }
            failureNode.appendChild(textNode);
            failureNode.setAttribute("class", "pref_show");
        }
    }
    onTogglePylintChecking(checkbox);
    
    // Update UI for pychecker
    checkbox = document.getElementById("lint_python_with_pychecker");
    onTogglePycheckerChecking(checkbox);
}

function loadPythonExecutable()
{
    loadExecutableIntoInterpreterList("pythonDefaultInterpreter");
    updateUI_part1();
}

function onTogglePylintChecking(checkbox) {
    var pylintEnabled = checkbox.checked;
    document.getElementById("pylint_checking_rcfile").disabled = !pylintEnabled;
    document.getElementById("pylint_browse_rcfile").disabled = !pylintEnabled;
}

function onTogglePycheckerChecking(checkbox) {
    var pycheckerEnabled = checkbox.checked;
    document.getElementById("pychecker_wrapper_location").disabled = !pycheckerEnabled;
    document.getElementById("pychecker_browse_wrapper_location").disabled = !pycheckerEnabled;
    document.getElementById("pychecker_checking_rcfile").disabled = !pycheckerEnabled;
    document.getElementById("pychecker_browse_rcfile").disabled = !pycheckerEnabled;
    updatePycheckerPathStatus();
    var pychecker_dangerous = document.getElementById("pychecker_dangerous");
    if (pycheckerEnabled) {
        pychecker_dangerous.setAttribute("class", "pref_show");
    } else {
        pychecker_dangerous.setAttribute("class", "pref_hide");
    }
        
        
}

function updatePycheckerPathStatus() {
    var failureNode = document.getElementById("pychecker_failure");
    if (document.getElementById("lint_python_with_pychecker").checked) {
        var hasPath = document.getElementById("pychecker_wrapper_location").value.length > 0;
        if (hasPath) {
            failureNode.setAttribute("class", "pref_hide");
        } else {
            failureNode.setAttribute("class", "pref_show");
        }
    } else {
        failureNode.setAttribute("class", "pref_hide");
    }
}

function loadTextboxFromFilepicker(eltID, prompt) {
    var textbox = document.getElementById(eltID);
    var currentValue = textbox.value;
    var defaultDirectory = null, defaultFilename = null;
    if (currentValue) {
        var koFileEx = Components.classes["@activestate.com/koFileEx;1"]
            .createInstance(Components.interfaces.koIFileEx);
        koFileEx.path = currentValue;
        defaultDirectory = koFileEx.dirName;
        defaultFilename = koFileEx.baseName;
    }
    var title = _bundle.GetStringFromName(prompt);
    var rcpath = ko.filepicker.browseForFile(defaultDirectory,
                                             defaultFilename, title);
    if (rcpath != null) {
        textbox.value = rcpath;
    }
}

function loadPylintRcfile() {
    loadTextboxFromFilepicker("pylint_checking_rcfile",
                              "Find a .pylintrc file");
}

function loadPycheckerRcFile() {
    loadTextboxFromFilepicker("pychecker_checking_rcfile",
                              "Find a .pycheckrc file");
}

function loadPycheckerWrapperFile() {
    loadTextboxFromFilepicker("pychecker_wrapper_location",
                              "Find a pychecker script");
    updatePycheckerPathStatus();
}

