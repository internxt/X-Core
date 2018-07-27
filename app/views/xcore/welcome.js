'use strict';
const electron = require('electron');

module.exports = {
    name: 'welcome',
    data: function () {
        return {
            displaySlider: false,
            newShare: window.Store.newShare,
            shareList: window.Store.shareList,
            MAXPORTNUM: 65536,
            MINPORTNUM: 1024,
            uiState: {
                isChecking: false
            },
            invalidPort: {
                port: -1,
                message: ''
            },
        };
    },
    beforeCreated: function () {
        this.newShare.actions.reset();        
    },
    created: function () {
        //Set tunnel options to 0 to prepare for removal of tunneling
        this.$set(this.newShare.config, 'maxTunnels', 0);
        this.$set(this.newShare.config, 'tunnelGatewayRange', {
            min: 0,
            max: 0
        });
        //Pre-fill their first payment address if they already have a share
        if (window.Store.shareList.shares.length > 0) {
            this.$set(this.newShare.config, 'paymentAddress', window.Store.shareList.shares[0].config.paymentAddress);
        }
        if (!this.newShare.storageAvailable) {
            this.newShare.errors.push(new Error('Invalid directory selected'));
        }
    },
    mounted: function() {
        this.bindUploadIcon();
    },
    methods: {
        checkEthereumAddress: function (address) {
            const utils = require('storjshare-daemon').utils;
            return utils.isValidEthereumAddress(address);
        },
        handleFileInput: function (event) {
            this.$set(this.newShare.config, 'storagePath', event.target.files[0].path);
            this.newShare.actions.getFreeDiskSpace(this.newShare.config.storagePath, () => {});
            document.getElementById('storagePath').style.color = "white";
            document.getElementById('storagePath').style.fontSize = "13.3333px"
        },
        pathIsValid: function () {
            for (let i = 0; i < this.shareList.shares.length; i++) {
                let share = this.shareList.shares[i];
                if (share.config.storagePath === this.newShare.config.storagePath) {
                    this.buttonText = 'Location In Use';
                    return false;
                }
            }
            if (!path.isAbsolute(this.newShare.config.storagePath)) {
                this.buttonText = 'Invalid Location';
                return false;
            }
            this.buttonText = 'Select Location';
            return true;
        },
        chooseRandomPort: function () {
            this.$set(this.newShare.config, 'rpcPort', this.getRandomValidPort());
        },
        getRandomValidPort: function () {
            return Math.floor(Math.random() * (this.MAXPORTNUM - this.MINPORTNUM)) + this.MINPORTNUM;
        },
        portIsAvailable: function (port, callback) {
            const utils = require('storjshare-daemon').utils;
            return utils.portIsAvailable(port, callback);
        },
        checkPort: function () {
            // this.continueButtonText = 'Checking...'; // TODO izmeniti ovo i ispod
            // this.uiState.isChecking = true;
            let self = this;
            this.portIsAvailable(this.newShare.config.rpcPort, function (err, result) {
                if (err || !result) {
                    self.invalidPort.port = self.newShare.config.rpcPort;
                    self.invalidPort.message = err || `Port ${self.invalidPort.port} appears to be in use`;
                    self.uiState.isChecking = false;
                    self.continueButtonText = 'Next';
                } else {
                    self.uiState.isChecking = false;
                }
            });
        },
        openPortSetup: function() {
            electron.shell.openExternal("https://internxt.com/portsetup");
        },
        validAllocation: function() {
            return this.newShare.config.storageAllocation <= this.newShare.storageAvailable;
        },
        validAddress: function() {
            return this.newShare.config.rpcAddress && this.newShare.config.rpcAddress.length !== 0;
        },
        saveToDisk: function() {
            let configPath = this.newShare.actions.createShareConfig();
            if(configPath) {
              this.shareList.actions.import(configPath, (err) => {
                if(!err) {
                  return this.$router.push({ path: '/settings' });
                }
              });
            }
        },
        bindUploadIcon: function() {
            var self = this;
            var imgBtn = document.getElementById('uploadImg');
            var fileBtn = document.getElementById('fileStorage');
            var storagePath = document.getElementById('storagePath');
            imgBtn.addEventListener('click', function(e) {
                document.getElementById('fileStorage').click();
            });
            fileBtn.addEventListener('change', function(e) {
                storagePath.innerText = fileBtn.files[0].path;
            })
        }
    },
    template: `
        <div>
            <section>
                <div class="db-widget-container">
                    <div class="db-widget-long">
                        <h3>Wallet Address</h3>
                        <input v-model="newShare.config.paymentAddress" class="input-field" type="text" placeholder="Enter a ERC20 wallet address">
                    </div>
                </div>
                <div class="db-widget-container">
                    <div class="db-widget-long">
                        <h3>File Storage Location</h3>
                        <input style="display:none" id="fileStorage" v-on:change="handleFileInput" class="input-field" type="file" placeholder="Select a location to store user files" webkitdirectory directory multiple/>
                        <label id="storagePath">Select a location to store user files</label>
                    </div>
                </div>
                <div class="db-widget-container">
                    <div class="db-widget-long">
                        <h3>Storage Allocated</h3> 
                        <input v-model="newShare.config.storageAllocation" v-bind:available="newShare.storageAvailable" class="input-field" type="text" placeholder="Enter amount of storage in MB(megabytes)">
                    </div>
                </div>
                <div class="db-widget-container">
                    <div class="db-widget-long">
                        <h3>Port Number</h3> <img id="portSetup" @click="openPortSetup" src="imgs/xcore/connection.png">
                        <input v-model.number="newShare.config.rpcPort" class="input-field" type="text" placeholder="Enter your routers port number">
                    </div>
                </div>
                <div class="db-widget-container">
                    <div class="db-widget-long">
                        <h3>Hostname</h3>
                        <input v-model="newShare.config.rpcAddress" class="input-field" type="text" placeholder="127.0.0.1">
                    </div>
                </div>
                <div class="db-widget-container">
                    <button id="createNode" v-on:click="saveToDisk()">Create your node</button>
                </div>
                <img id="uploadImg" src="imgs/xcore/upload.png">
                <img id="connectionImg" @click="chooseRandomPort" src="imgs/xcore/connection.png">
            </section>
        </div>
    `
};