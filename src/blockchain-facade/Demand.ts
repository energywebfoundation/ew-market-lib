import * as GeneralLib from 'ew-utils-general-lib';
import DemandOffchainpropertiesSchema from '../../schemas/DemandOffChainProperties.schema.json';

export interface DemandOffchainproperties {
    timeframe: GeneralLib.TimeFrame;
    pricePerCertifiedWh: number;
    currency: GeneralLib.Currency;
    productingAsset?: number;
    consumingAsset?: number;
    locationCountry?: string;
    locationRegion?: string;
    assettype?: GeneralLib.AssetType;
    minCO2Offset?: number;
    otherGreenAttributes?: string;
    typeOfPublicSupport?: string;
    targetWhPerPeriod: number;
    registryCompliance?: GeneralLib.Compliance;
}

export interface DemandOnChainProperties extends GeneralLib.BlockchainDataModelEntity.OnChainProperties {
    demandOwner: string;
}

export const getDemandListLength = async (configuration: GeneralLib.Configuration.Entity) => {

    return parseInt(await configuration.blockchainProperties.marketLogicInstance.getAllDemandListLength(), 10);
};

export const createDemand =
    async (demandPropertiesOnChain: DemandOnChainProperties,
           demandPropertiesOffChain: DemandOffchainproperties,
           configuration: GeneralLib.Configuration.Entity): Promise<Entity> => {
        const demand = new Entity(null, configuration);

        console.log(demandPropertiesOnChain);

        const offChainStorageProperties =
            demand.prepareEntityCreation(
                demandPropertiesOnChain,
                demandPropertiesOffChain,
                DemandOffchainpropertiesSchema,
                demand.getUrl(), true);

        console.log(offChainStorageProperties);

        if (configuration.offChainDataSource) {
            demandPropertiesOnChain.url = demand.getUrl();
            demandPropertiesOnChain.propertiesDocumentHash = offChainStorageProperties.rootHash;
        }

        const tx = await configuration.blockchainProperties.marketLogicInstance.createDemand(
            demandPropertiesOnChain.propertiesDocumentHash,
            demandPropertiesOnChain.url,
            {
                from: configuration.blockchainProperties.activeUser.address,
                privateKey: configuration.blockchainProperties.activeUser.privateKey,
            },
        );

        demand.id = configuration.blockchainProperties.web3.utils.hexToNumber(tx.logs[0].topics[1]).toString();

        await demand.putToOffChainStorage(demandPropertiesOffChain, offChainStorageProperties);

        configuration.logger.info(`Demand ${demand.id} created`);

        return demand.sync();

    };

export class Entity extends GeneralLib.BlockchainDataModelEntity.Entity implements DemandOnChainProperties {

    offChainProperties: DemandOffchainproperties;
    propertiesDocumentHash: string;
    url: string;

    demandOwner: string;

    initialized: boolean;
    configuration: GeneralLib.Configuration.Entity;

    constructor(id: string, configuration: GeneralLib.Configuration.Entity) {
        super(id, configuration);

        this.initialized = false;
    }

    getUrl(): string {
        return `${this.configuration.offChainDataSource.baseUrl}/Demand`;
    }

    async sync(): Promise<Entity> {
        if (this.id != null) {
            const demand = await this.configuration.blockchainProperties.marketLogicInstance.getDemand(this.id);

            this.propertiesDocumentHash = demand._propertiesDocumentHash;
            this.url = demand._documentDBURL;
            this.demandOwner = demand._owner;
            this.initialized = true;
            this.offChainProperties = await this.getOffChainProperties(this.propertiesDocumentHash);

            if (this.configuration.logger) {
                this.configuration.logger.verbose(`Demand ${this.id} synced`);
            }
        }
        return this;

    }
}
