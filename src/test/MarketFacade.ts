// Copyright 2018 Energy Web Foundation
// This file is part of the Origin Application brought to you by the Energy Web Foundation,
// a global non-profit organization focused on accelerating blockchain technology across the energy sector,
// incorporated in Zug, Switzerland.
//
// The Origin Application is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// This is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY and without an implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details, at <http://www.gnu.org/licenses/>.
//
// @authors: slock.it GmbH, Martin Kuechler, martin.kuechler@slock.it

import { assert } from 'chai';
import * as fs from 'fs';

import 'mocha';
import Web3 = require('web3');
import * as GeneralLib from 'ew-utils-general-lib';
import { logger } from '../Logger';
import { UserContractLookup, UserLogic, migrateUserRegistryContracts, buildRights, Role } from 'ew-user-registry-lib';
import {
    migrateAssetRegistryContracts,
    AssetConsumingRegistryLogic,
    AssetProducingRegistryLogic
} from 'ew-asset-registry-lib';
import { MarketLogic } from '..';
import { migrateMarketRegistryContracts } from '../utils/migrateContracts';
import * as Market from '..';
import { ProducingAsset } from 'ew-asset-registry-lib';
import { deepEqual } from 'assert';
import {
    IAgreementOffChainProperties,
    IMatcherOffChainProperties
} from '../blockchain-facade/Agreement';
import { timingSafeEqual } from 'crypto';

describe('Market-Facade', () => {
    const configFile = JSON.parse(
        fs.readFileSync(process.cwd() + '/connection-config.json', 'utf8')
    );

    const web3 = new Web3(configFile.develop.web3);

    const privateKeyDeployment = configFile.develop.deployKey.startsWith('0x')
        ? configFile.develop.deployKey
        : '0x' + configFile.develop.deployKey;

    const accountDeployment = web3.eth.accounts.privateKeyToAccount(privateKeyDeployment).address;

    console.log('acc-deployment: ' + accountDeployment);
    let conf: GeneralLib.Configuration.Entity;
    let userLogic: UserLogic;
    let userContractLookup: UserContractLookup;
    let assetProducingRegistry: AssetProducingRegistryLogic;
    let marketLogic: MarketLogic;

    let userContractLookupAddr;
    let assetContractLookupAddr;

    const assetOwnerPK = '0xfaab95e72c3ac39f7c060125d9eca3558758bb248d1a4cdc9c1b7fd3f91a4485';
    const assetOwnerAddress = web3.eth.accounts.privateKeyToAccount(assetOwnerPK).address;

    const assetSmartmeterPK = '0x2dc5120c26df339dbd9861a0f39a79d87e0638d30fdedc938861beac77bbd3f5';
    const assetSmartmeter = web3.eth.accounts.privateKeyToAccount(assetSmartmeterPK).address;

    const matcherPK = '0xc118b0425221384fe0cbbd093b2a81b1b65d0330810e0792c7059e518cea5383';
    const matcher = web3.eth.accounts.privateKeyToAccount(matcherPK).address;

    const assetSmartmeter2PK = '0x554f3c1470e9f66ed2cf1dc260d2f4de77a816af2883679b1dc68c551e8fa5ed';
    const assetSmartMeter2 = web3.eth.accounts.privateKeyToAccount(assetSmartmeter2PK).address;

    const traderPK = '0x2dc5120c26df339dbd9861a0f39a79d87e0638d30fdedc938861beac77bbd3f5';
    const accountTrader = web3.eth.accounts.privateKeyToAccount(traderPK).address;

    it('should deploy user-registry contracts', async () => {
        const userContracts = await migrateUserRegistryContracts(web3, privateKeyDeployment);
        userContractLookupAddr = (userContracts as any).UserContractLookup;

        userLogic = new UserLogic(web3 as any, (userContracts as any).UserLogic);
        await userLogic.setUser(accountDeployment, 'admin', { privateKey: privateKeyDeployment });

        await userLogic.setRoles(accountDeployment, buildRights([
            Role.UserAdmin,
            Role.AssetAdmin,
            Role.AssetManager,
            Role.Trader,
            Role.Matcher
        ]), { privateKey: privateKeyDeployment });

        await userLogic.setUser(accountTrader, 'trader', { privateKey: privateKeyDeployment });
        await userLogic.setRoles(accountTrader, buildRights([
            Role.Trader
        ]), { privateKey: privateKeyDeployment });

        await userLogic.setUser(assetOwnerAddress, 'assetOwner', {
            privateKey: privateKeyDeployment
        });
        await userLogic.setRoles(assetOwnerAddress, buildRights([
            Role.AssetManager
        ]), { privateKey: privateKeyDeployment });
    });

    it('should deploy asset-registry contracts', async () => {
        const deployedContracts = await migrateAssetRegistryContracts(
            web3 as any,
            userContractLookupAddr,
            privateKeyDeployment
        );
        assetProducingRegistry = new AssetProducingRegistryLogic(
            web3 as any,
            (deployedContracts as any).AssetProducingRegistryLogic
        );
        assetContractLookupAddr = (deployedContracts as any).AssetContractLookup;
    });

    it('should deploy market-registry contracts', async () => {
        const deployedContracts = await migrateMarketRegistryContracts(
            web3 as any,
            assetContractLookupAddr,
            privateKeyDeployment
        );
        marketLogic = new MarketLogic(web3 as any, (deployedContracts as any).MarketLogic);
    });

    describe('Demand-Facade', () => {
        const START_TIME = '1559466472732';
        const END_TIME = '1559466492732';
        
        it('should create a demand', async () => {
            conf = {
                blockchainProperties: {
                    activeUser: {
                        address: accountTrader,
                        privateKey: traderPK
                    },
                    userLogicInstance: userLogic,
                    producingAssetLogicInstance: assetProducingRegistry,
                    marketLogicInstance: marketLogic,
                    web3
                },
                offChainDataSource: {
                    baseUrl: 'http://localhost:3030'
                },
                logger
            };

            const demandOffchainProps: Market.Demand.IDemandOffChainProperties = {
                timeframe: GeneralLib.TimeFrame.hourly,
                maxPricePerMwh: 1.5,
                currency: GeneralLib.Currency.USD,
                productingAsset: 0,
                consumingAsset: 0,
                locationCountry: 'string',
                locationRegion: 'string',
                assettype: GeneralLib.AssetType.BiomassGas,
                minCO2Offset: 10,
                otherGreenAttributes: 'string',
                typeOfPublicSupport: 'string',
                targetWhPerPeriod: 10,
                registryCompliance: GeneralLib.Compliance.EEC,
                startTime: START_TIME,
                endTime: END_TIME
            };

            const demandProps: Market.Demand.IDemandOnChainProperties = {
                url: null,
                propertiesDocumentHash: null,
                demandOwner: conf.blockchainProperties.activeUser.address
            };
            assert.equal(await Market.Demand.getDemandListLength(conf), 0);

            const demand = await Market.Demand.createDemand(demandProps, demandOffchainProps, conf);
            assert.equal(await Market.Demand.getDemandListLength(conf), 1);

            delete demand.proofs;
            delete demand.configuration;
            delete demand.propertiesDocumentHash;

            assert.deepEqual(demand as any, {
                id: '0',
                initialized: true,
                url: `http://localhost:3030/Demand/${marketLogic.web3Contract._address}`,
                demandOwner: accountTrader,
                offChainProperties: {
                    assettype: 3,
                    consumingAsset: 0,
                    currency: GeneralLib.Currency.USD,
                    locationCountry: 'string',
                    locationRegion: 'string',
                    minCO2Offset: 10,
                    otherGreenAttributes: 'string',
                    maxPricePerMwh: 1.5,
                    productingAsset: 0,
                    registryCompliance: 2,
                    targetWhPerPeriod: 10,
                    timeframe: 3,
                    typeOfPublicSupport: 'string',
                    startTime: START_TIME,
                    endTime: END_TIME
                }
            });
        });

        it('should return 1 demand for getAllDemands', async () => {
            const allDemands = await Market.Demand.getAllDemands(conf);
            assert.equal(allDemands.length, 1);
        });

        it('should return demand', async () => {
            const demand: Market.Demand.Entity = await new Market.Demand.Entity('0', conf).sync();

            delete demand.proofs;
            delete demand.configuration;
            delete demand.propertiesDocumentHash;

            assert.deepEqual(demand as any, {
                id: '0',
                initialized: true,
                url: `http://localhost:3030/Demand/${marketLogic.web3Contract._address}`,
                demandOwner: accountTrader,
                offChainProperties: {
                    assettype: 3,
                    consumingAsset: 0,
                    currency: GeneralLib.Currency.USD,
                    locationCountry: 'string',
                    locationRegion: 'string',
                    minCO2Offset: 10,
                    otherGreenAttributes: 'string',
                    maxPricePerMwh: 1.5,
                    productingAsset: 0,
                    registryCompliance: 2,
                    targetWhPerPeriod: 10,
                    timeframe: 3,
                    typeOfPublicSupport: 'string',
                    startTime: START_TIME,
                    endTime: END_TIME
                }
            });
        });
    });

    describe('Supply-Facade', () => {
        it('should onboard an asset', async () => {
            conf.blockchainProperties.activeUser = {
                address: accountDeployment,
                privateKey: privateKeyDeployment
            };

            const assetProps: ProducingAsset.IOnChainProperties = {
                smartMeter: { address: assetSmartmeter },
                owner: { address: assetOwnerAddress },
                lastSmartMeterReadWh: 0,
                active: true,
                lastSmartMeterReadFileHash: 'lastSmartMeterReadFileHash',
                matcher: [{ address: matcher }],
                propertiesDocumentHash: null,
                url: null,
                maxOwnerChanges: 3
            };

            const assetPropsOffChain: ProducingAsset.IOffChainProperties = {
                operationalSince: 0,
                capacityWh: 10,
                country: 'USA',
                region: 'AnyState',
                zip: '012345',
                city: 'Anytown',
                street: 'Main-Street',
                houseNumber: '42',
                gpsLatitude: '0.0123123',
                gpsLongitude: '31.1231',
                assetType: ProducingAsset.Type.Wind,
                complianceRegistry: ProducingAsset.Compliance.EEC,
                otherGreenAttributes: '',
                typeOfPublicSupport: '',
                facilityName: ''
            };

            assert.equal(await ProducingAsset.getAssetListLength(conf), 0);

            const asset = await ProducingAsset.createAsset(
                assetProps,
                assetPropsOffChain,
                conf
            );
        });

        it('should onboard an supply', async () => {
            conf.blockchainProperties.activeUser = {
                address: assetOwnerAddress,
                privateKey: assetOwnerPK
            };

            const supplyOffChainProperties: Market.Supply.ISupplyOffchainProperties = {
                price: 10,
                currency: GeneralLib.Currency.USD,
                availableWh: 10,
                timeframe: GeneralLib.TimeFrame.hourly
            };

            const supplyProps: Market.Supply.ISupplyOnChainProperties = {
                url: null,
                propertiesDocumentHash: null,
                assetId: 0
            };

            assert.equal(await Market.Supply.getSupplyListLength(conf), 0);

            const supply = await Market.Supply.createSupply(
                supplyProps,
                supplyOffChainProperties,
                conf
            );

            assert.equal(await Market.Supply.getSupplyListLength(conf), 1);
            delete supply.proofs;
            delete supply.configuration;
            delete supply.propertiesDocumentHash;

            assert.deepEqual(supply as any, {
                id: '0',
                initialized: true,
                url: 'http://localhost:3030/Supply',
                assetId: '0',
                offChainProperties: {
                    availableWh: 10,
                    currency: GeneralLib.Currency.USD,
                    price: 10,
                    timeframe: 3
                }
            });
        });

        it('should return supply', async () => {
            const supply: Market.Supply.Entity = await new Market.Supply.Entity('0', conf).sync();

            delete supply.proofs;
            delete supply.configuration;
            delete supply.propertiesDocumentHash;

            assert.deepEqual(supply as any, {
                id: '0',
                initialized: true,
                url: 'http://localhost:3030/Supply',
                assetId: '0',
                offChainProperties: {
                    availableWh: 10,
                    currency: GeneralLib.Currency.USD,
                    price: 10,
                    timeframe: 3
                }
            });
        });

        it('should get all supplies', async () => {
            const allSupplies = await Market.Supply.getAllSupplies(conf);
            assert.equal(allSupplies.length, 1);
        });
    });

    describe('Agreement-Facade', () => {
        let startTime;
        it('should create an agreement', async () => {
            conf.blockchainProperties.activeUser = {
                address: accountTrader,
                privateKey: traderPK
            };

            startTime = Date.now();

            const agreementOffchainProps: IAgreementOffChainProperties = {
                start: startTime,
                end: startTime + 1000,
                price: 10,
                currency: GeneralLib.Currency.USD,
                period: 10,
                timeframe: GeneralLib.TimeFrame.hourly
            };

            const matcherOffchainProps: IMatcherOffChainProperties = {
                currentWh: 0,
                currentPeriod: 0
            };

            const agreementProps: Market.Agreement.IAgreementOnChainProperties = {
                propertiesDocumentHash: null,
                url: null,
                matcherDBURL: null,
                matcherPropertiesDocumentHash: null,
                demandId: 0,
                supplyId: 0,
                allowedMatcher: []
            };

            const agreement = await Market.Agreement.createAgreement(
                agreementProps,
                agreementOffchainProps,
                matcherOffchainProps,
                conf
            );

            assert.equal(await Market.Agreement.getAgreementListLength(conf), 1);

            delete agreement.proofs;
            delete agreement.configuration;
            delete agreement.propertiesDocumentHash;
            delete agreement.matcherPropertiesDocumentHash;

            assert.deepEqual(agreement as any, {
                allowedMatcher: [matcher],
                id: '0',
                initialized: true,
                url: 'http://localhost:3030/Agreement',
                demandId: '0',
                supplyId: '0',
                approvedBySupplyOwner: false,
                approvedByDemandOwner: true,
                matcherDBURL: 'http://localhost:3030/Matcher',
                matcherOffChainProperties: {
                    currentPeriod: 0,
                    currentWh: 0
                },
                offChainProperties: {
                    currency: GeneralLib.Currency.USD,
                    end: startTime + 1000,
                    period: 10,
                    price: 10,
                    start: startTime,
                    timeframe: 3
                }
            });
        });

        it('should return an agreement', async () => {
            const agreement: Market.Agreement.Entity = await new Market.Agreement.Entity(
                '0',
                conf
            ).sync();

            delete agreement.proofs;
            delete agreement.configuration;
            delete agreement.propertiesDocumentHash;
            delete agreement.matcherPropertiesDocumentHash;

            assert.deepEqual(agreement as any, {
                allowedMatcher: [matcher],
                id: '0',
                initialized: true,
                url: 'http://localhost:3030/Agreement',
                demandId: '0',
                supplyId: '0',
                approvedBySupplyOwner: false,
                approvedByDemandOwner: true,
                matcherDBURL: 'http://localhost:3030/Matcher',
                matcherOffChainProperties: {
                    currentPeriod: 0,
                    currentWh: 0
                },
                offChainProperties: {
                    currency: GeneralLib.Currency.USD,
                    end: startTime + 1000,
                    period: 10,
                    price: 10,
                    start: startTime,
                    timeframe: 3
                }
            });
        });

        it('should agree to an agreement as supply', async () => {
            conf.blockchainProperties.activeUser = {
                address: assetOwnerAddress,
                privateKey: assetOwnerPK
            };

            let agreement: Market.Agreement.Entity = await new Market.Agreement.Entity(
                '0',
                conf
            ).sync();

            await agreement.approveAgreementSupply();

            agreement = await agreement.sync();
            delete agreement.proofs;
            delete agreement.configuration;
            delete agreement.propertiesDocumentHash;
            delete agreement.matcherPropertiesDocumentHash;

            assert.deepEqual(agreement as any, {
                allowedMatcher: [matcher],
                id: '0',
                initialized: true,
                url: 'http://localhost:3030/Agreement',
                demandId: '0',
                supplyId: '0',
                approvedBySupplyOwner: true,
                approvedByDemandOwner: true,
                matcherDBURL: 'http://localhost:3030/Matcher',
                matcherOffChainProperties: {
                    currentPeriod: 0,
                    currentWh: 0
                },
                offChainProperties: {
                    currency: GeneralLib.Currency.USD,
                    end: startTime + 1000,
                    period: 10,
                    price: 10,
                    start: startTime,
                    timeframe: 3
                }
            });
        });

        it('should create a 2nd agreement', async () => {
            conf.blockchainProperties.activeUser = {
                address: assetOwnerAddress,
                privateKey: assetOwnerPK
            };

            startTime = Date.now();

            const agreementOffchainProps: IAgreementOffChainProperties = {
                start: startTime,
                end: startTime + 1000,
                price: 10,
                currency: GeneralLib.Currency.USD,
                period: 10,
                timeframe: GeneralLib.TimeFrame.hourly
            };

            const matcherOffchainProps: IMatcherOffChainProperties = {
                currentWh: 0,
                currentPeriod: 0
            };

            const agreementProps: Market.Agreement.IAgreementOnChainProperties = {
                propertiesDocumentHash: null,
                url: null,
                matcherDBURL: null,
                matcherPropertiesDocumentHash: null,
                demandId: 0,
                supplyId: 0,
                allowedMatcher: []
            };

            const agreement = await Market.Agreement.createAgreement(
                agreementProps,
                agreementOffchainProps,
                matcherOffchainProps,
                conf
            );

            assert.equal(await Market.Agreement.getAgreementListLength(conf), 2);

            delete agreement.proofs;
            delete agreement.configuration;
            delete agreement.propertiesDocumentHash;
            delete agreement.matcherPropertiesDocumentHash;

            assert.deepEqual(agreement as any, {
                allowedMatcher: [matcher],
                id: '1',
                initialized: true,
                url: 'http://localhost:3030/Agreement',
                demandId: '0',
                supplyId: '0',
                approvedBySupplyOwner: true,
                approvedByDemandOwner: false,
                matcherDBURL: 'http://localhost:3030/Matcher',
                matcherOffChainProperties: {
                    currentPeriod: 0,
                    currentWh: 0
                },
                offChainProperties: {
                    currency: GeneralLib.Currency.USD,
                    end: startTime + 1000,
                    period: 10,
                    price: 10,
                    start: startTime,
                    timeframe: 3
                }
            });
        });

        it('should agree to an agreement as demand', async () => {
            conf.blockchainProperties.activeUser = {
                address: accountTrader,
                privateKey: traderPK
            };

            let agreement: Market.Agreement.Entity = await new Market.Agreement.Entity(
                '1',
                conf
            ).sync();

            await agreement.approveAgreementDemand();

            agreement = await agreement.sync();
            delete agreement.proofs;
            delete agreement.configuration;
            delete agreement.propertiesDocumentHash;
            delete agreement.matcherPropertiesDocumentHash;

            assert.deepEqual(agreement as any, {
                allowedMatcher: [matcher],
                id: '1',
                initialized: true,
                url: 'http://localhost:3030/Agreement',
                demandId: '0',
                supplyId: '0',
                approvedBySupplyOwner: true,
                approvedByDemandOwner: true,
                matcherDBURL: 'http://localhost:3030/Matcher',
                matcherOffChainProperties: {
                    currentPeriod: 0,
                    currentWh: 0
                },
                offChainProperties: {
                    currency: GeneralLib.Currency.USD,
                    end: startTime + 1000,
                    period: 10,
                    price: 10,
                    start: startTime,
                    timeframe: 3
                }
            });
        });

        it('should change matcherProperties', async () => {
            conf.blockchainProperties.activeUser = {
                address: matcher,
                privateKey: matcherPK
            };

            let agreement: Market.Agreement.Entity = await new Market.Agreement.Entity(
                '1',
                conf
            ).sync();

            const matcherOffchainProps: IMatcherOffChainProperties = {
                currentWh: 100,
                currentPeriod: 0
            };

            await agreement.setMatcherProperties(matcherOffchainProps);

            agreement = await agreement.sync();
            delete agreement.proofs;
            delete agreement.configuration;
            delete agreement.propertiesDocumentHash;
            delete agreement.matcherPropertiesDocumentHash;

            assert.deepEqual(agreement as any, {
                allowedMatcher: [matcher],
                id: '1',
                initialized: true,
                url: 'http://localhost:3030/Agreement',
                demandId: '0',
                supplyId: '0',
                approvedBySupplyOwner: true,
                approvedByDemandOwner: true,
                matcherDBURL: 'http://localhost:3030/Matcher',
                matcherOffChainProperties: {
                    currentPeriod: 0,
                    currentWh: 100
                },
                offChainProperties: {
                    currency: GeneralLib.Currency.USD,
                    end: startTime + 1000,
                    period: 10,
                    price: 10,
                    start: startTime,
                    timeframe: 3
                }
            });
        });

        it('should get all agreements', async () => {
            const allAgreements = await Market.Agreement.getAllAgreements(conf);

            assert.equal(allAgreements.length, 2);
            assert.equal(allAgreements.length, await Market.Agreement.getAgreementListLength(conf));
        });

        it('should delete a demand', async () => {
            conf.blockchainProperties.activeUser = {
                address: accountTrader,
                privateKey: traderPK
            };

            assert.equal(await Market.Demand.getDemandListLength(conf), 1);

            const deleted = await Market.Demand.deleteDemand(0, conf);
            assert.isTrue(deleted);

            // Should remain the same
            assert.equal(await Market.Demand.getDemandListLength(conf), 1);
        });

        it('should get all demands even after a demand is deleted', async () => {
            const allDemands = await Market.Demand.getAllDemands(conf);
            assert.equal(allDemands.length, 0);
        });
    });
});
