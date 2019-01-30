import * as GeneralLib from 'ew-utils-general-lib';
import AgreementOffchainPropertiesSchema from '../../schemas/AgreementOffChainProperties.schema.json';
import MatcherOffchainPropertiesSchema from '../../schemas/MatcherOffchainProperties.schema.json';

export interface AgreementOffChainProperties {
    start: number;
    ende: number;
    price: number;
    currency: string;
    period: number;
}

export interface MatcherOffchainProperties {
    currentWh: number;
    currentPeriod: number;
}

export interface AgreementOnChainProperties extends GeneralLib.BlockchainDataModelEntity.OnChainProperties {
    matcherPropertiesDocumentHash: string;
    matcherDBURL: string;
    demandId: number;
    supplyId: number;
    allowedMatcher: string[];
}

export const createAgreement =
    async (agreementPropertiesOnChain: AgreementOnChainProperties,
           agreementPropertiesOffchain: AgreementOffChainProperties,
           matcherPropertiesOffchain: MatcherOffchainProperties,
           configuration: GeneralLib.Configuration.Entity): Promise<Entity> => {

        const agreement = new Entity(null, configuration);

        const agreementOffChainStorageProperties = agreement.prepareEntityCreation(
            agreementPropertiesOnChain,
            agreementPropertiesOffchain,
            AgreementOffchainPropertiesSchema,
            false);

        const matcherOffchainStorageProperties = agreement.prepareEntityCreation(
            agreementPropertiesOnChain,
            matcherPropertiesOffchain,
            MatcherOffchainPropertiesSchema,
            false);

        if (configuration.offChainDataSource) {
            agreementPropertiesOnChain.url = agreement.getUrl();
            agreementPropertiesOnChain.propertiesDocumentHash = agreementOffChainStorageProperties.rootHash;

            agreementPropertiesOnChain.matcherDBURL = agreement.getMatcherURL();
            agreementPropertiesOnChain.matcherPropertiesDocumentHash = matcherOffchainStorageProperties.rootHash;
        }

        const tx = await configuration.blockchainProperties.demandLogicInstance.createAgreement(
            agreementPropertiesOnChain.propertiesDocumentHash,
            agreementPropertiesOnChain.url,
            agreementPropertiesOnChain.matcherPropertiesDocumentHash,
            agreementPropertiesOnChain.matcherDBURL,
            agreementPropertiesOnChain.demandId,
            agreementPropertiesOnChain.supplyId,
            {
                from: configuration.blockchainProperties.activeUser.address,
                privateKey: configuration.blockchainProperties.activeUser.privateKey,
            },
        );

        agreement.id = configuration.blockchainProperties.web3.utils.hexToNumber(tx.logs[0].topics[1]).toString();

        configuration.logger.info(`Agreement ${agreement.id} created`);

        return agreement.sync();

        return null;

    };

export class Entity extends GeneralLib.BlockchainDataModelEntity.Entity implements AgreementOnChainProperties {

    propertiesDocumentHash: string;
    url: string;
    matcherPropertiesDocumentHash: string;
    matcherDBURL: string;
    demandId: number;
    supplyId: number;
    approvedBySupplyOwner: boolean;
    approvedByDemandOwner: boolean;
    allowedMatcher: string[];

    initialized: boolean;
    configuration: GeneralLib.Configuration.Entity;

    constructor(id: string, configuration: GeneralLib.Configuration.Entity) {

        super(id, configuration);
        this.initialized = true;
    }

    getUrl(): string {
        return `${this.configuration.offChainDataSource.baseUrl}/Agreement`;
    }

    getMatcherURL(): string {
        return `${this.configuration.offChainDataSource.baseUrl}/Matcher`;
    }

    async sync(): Promise<Entity> {
        if (this.id != null) {
            const agreement = await this.configuration.blockchainProperties.demandLogicInstance.getAgreement(this.id);

            this.propertiesDocumentHash = agreement._propertiesDocumentHash;
            this.url = agreement._documentDBURL;
            this.matcherPropertiesDocumentHash = agreement._matcherPropertiesDocumentHash;
            this.matcherDBURL = agreement._matcherDBURL;
            this.demandId = agreement._demandId;
            this.supplyId = agreement._supplyId;
            this.approvedBySupplyOwner = agreement._approvedBySupplyOwner;
            this.approvedByDemandOwner = agreement._approvedByDemandOwner;
            this.allowedMatcher = agreement._allowedMatcher;

            this.initialized = true;
        }
        return this;

    }
}