import {LogManager} from 'aurelia-framework';
import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import {IdentityService} from './services/identity-service';
import {ChaincodeService} from './services/chaincode-service';
import {ConfigService} from './services/config-service';
import {AlertService} from './services/alert-service';
import JSONFormatter from '../node_modules/json-formatter-js/dist/json-formatter'
let log = LogManager.getLogger('Home');

@inject(IdentityService, EventAggregator, ChaincodeService, ConfigService, AlertService)
export class Home {
  channelList = [];
  chaincodeList = [];
  orgList = [];
  installedChain = [];
  blocks = [];
  targets = [];
  oneChannel = null;
  oneChaincode = null;
  targs = [];
  newOrg = null;
  fnc = null;
  args = null;
  selectedChain = null;
  oneCh = null;
  file = null;
  initArgs = null;
  block = null;
  joinCh = null;


  constructor(identityService, eventAggregator, chaincodeService, configService, alertService) {
    this.identityService = identityService;
    this.eventAggregator = eventAggregator;
    this.chaincodeService = chaincodeService;
    this.configService = configService;
    this.alertService = alertService;
  }

  attached() {
    this.queryChannels();
    this.subscriberBlock = this.eventAggregator.subscribe('block', o => {
      log.debug('block', o);
      this.queryChannels();
      if (o.channel_id === this.oneChannel)
        this.updateBlock();
      if (this.oneChannel) {
        this.queryChaincodes();
        this.queryOrgs();
      }
    });
  }

  detached() {
    this.subscriberBlock.dispose();
  }

  queryChannels() {
    this.chaincodeService.getChannels().then(channels => {
      this.channelList = channels;
      this.channelList.sort();
    });
  }

  addChannel() {
    let re = /^[a-z][a-z0-9.-]*$/;
    if (this.oneCh && re.test(this.oneCh) && this.channelList.indexOf(this.oneCh) === -1) {
      this.chaincodeService.addChannel(this.oneCh);
      this.channelList.sort();
      this.oneCh = null;
    }
    else
      this.alertService.error("ALOOOO");
  }

  installChaincode() {
    let formData = new FormData();
    for (let i = 0; i < this.file.length; i++) {
      formData.append('file', this.file[i]);
    }
    formData.append('channelId', this.oneChannel);
    formData.append('targets', this.targs);
    formData.append('version', '1.0');
    formData.append('language', 'node');
    this.chaincodeService.installChaincode(formData).then(j => {
      console.log(this.installedChain);
      if (!j.startsWith('Error'))
        this.installedChain.push(j.substring(10, j.length - 23));
      console.log(this.installedChain);
    });
  }

  initChaincode() {
    this.chaincodeService.instantiateChaincode(this.oneChannel, this.selectedChain, this.initArgs, this.targs);
    this.selectedChain = null;
  }

  queryChaincodes() {
    this.chaincodeService.getChaincodes(this.oneChannel).then(chaincodes => {
      this.chaincodeList = chaincodes;
    });
  }

  queryPeers() {
    this.targets = [];
    this.chaincodeService.getPeersForOrgOnChannel(this.oneChannel).then(peers => {
      for (let i = 0; i < peers.length; i++) {
        this.targets.push(peers[i]);
      }
    });
  }

  queryOrgs() {
    this.chaincodeService.getOrgs(this.oneChannel).then(orgs => {
      this.orgList = orgs;
    });
  }

  queryInstalledChaincodes() {
    this.chaincodeService.getInstalledChaincodes().then(chain => {
      this.installedChain = chain;
    });
  }

  getLastBlock() {
    this.chaincodeService.getLastBlock(this.oneChannel).then(lastBlock => {
      this.chaincodeService.getBlock(this.oneChannel, lastBlock - 1).then(block => {
        let formatter = new JSONFormatter(block);
        Home.output(formatter.render(), "json");
        for (let j = 0; j < block.data.data.length; j++) {
          const info = block.data.data[j].payload.header;
          formatter = new JSONFormatter(info.signature_header.creator.IdBytes);
          Home.output(formatter.render(), 'info');
        }
      });
    });
  }

  addOrgToChannel() {
    console.log(this.oneChannel);
    console.log(this.newOrg);
    this.chaincodeService.addOrgToChannel(this.oneChannel, this.newOrg).then(info => {
      console.log(info);
      this.newOrg = null;
    })
  }

  joinChannel() {
    this.chaincodeService.joinChannel(this.joinCh).then(info => {
      this.joinCh = null;
    })
  }

  queryBlocks() {
    this.blocks = [];
    let bl = [];
    this.chaincodeService.getLastBlock(this.oneChannel).then(block => {
      for (let i = block - 5; i < block; i++) {
        if (i < 0)
          continue;
        this.chaincodeService.getBlock(this.oneChannel, i).then(block => {
          let txid = [];
          for (let j = 0; j < block.data.data.length; j++) {
            txid.push(block.data.data[j].payload.header.channel_header.tx_id)
          }
          bl.push({blockNumber: block.header.number, txid: txid.join('; ')});
          bl.sort(function (a, b) {
            return a.blockNumber - b.blockNumber
          });
        });
      }
    });
    bl.sort(function (a, b) {
      return a.blockNumber - b.blockNumber
    });
    this.blocks = bl;
  }

  getInvoke() {
    this.chaincodeService.invoke(this.oneChannel, this.oneChaincode, this.fnc, this.args, this.targs).then(invoke => {
      const formatter = new JSONFormatter(invoke);
      Home.output(formatter.render(), "res");
    });
    // this.chaincodeService.invoke('common', 'reference', 'put', 'account 1 one', this.targs).then(invoke => {
    //   const formatter = new JSONFormatter(invoke);
    //   Home.output(formatter.render(), "res");
    // });
  }

  getQuery() {
    this.chaincodeService.query(this.oneChannel, this.oneChaincode, this.fnc, this.args, this.targs).then(query => {
      const formatter = new JSONFormatter(query);
      Home.output(formatter.render(), "res");
    });
  }

  updateBlock() {
    if (this.blocks.length > 4)
      this.blocks.splice(0, 1);
    this.chaincodeService.getLastBlock(this.oneChannel).then(lastBlock => {
      this.chaincodeService.getBlock(this.oneChannel, lastBlock - 1).then(block => {
        let txid = [];
        let formatter = new JSONFormatter(block);
        Home.output(formatter.render(), "json");
        for (let j = 0; j < block.data.data.length; j++) {
          const info = block.data.data[j].payload.header;
          txid.push(info.channel_header.tx_id);
          // this.decodeCert(info.signature_header.creator);
          formatter = new JSONFormatter(info.signature_header.creator.IdBytes);
          Home.output(formatter.render(), 'info');
        }
        this.blocks.push({blockNumber: lastBlock - 1, txid: txid.join('; ')});
      });
    });
  }

  // decodeCert(cert) {
  //     const formatter = new JSONFormatter(x509.parseCert(cert));
  //     Home.output(formatter.render(), 'info');
  // }

  static output(inp, id) {
    const el = document.getElementById(id);
    if (el.firstChild === null)
      el.appendChild(inp);
    else
      el.removeChild(el.firstChild);
    el.appendChild(inp);
  }
}
