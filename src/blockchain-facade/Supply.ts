import * as GeneralLib from 'ew-utils-general-lib';
import SupplyOffchainpropertiesSchema from '../../schemas/SupplyOffchainProperties.schema.json';

export interface SupplyOffchainProperties {
    price: number;
    currency: GeneralLib.Currency;
    availableWh: number;
    timeframe: GeneralLib.TimeFrame;

}

export interface SupplyOnChainProperties extends GeneralLib.BlockchainDataModelEntity.OnChainProperties {
    assetId: number;
}

export const getSupplyListLength = async (configuration: GeneralLib.Configuration.Entity) => {

    return parseInt(await configuration.blockchainProperties.marketLogicInstance.getAllDemandListLength(), 10);
};

export const createSupply =
    async (supplyPropertiesOnChain: SupplyOnChainProperties,
        supplyPropertiesOffChain: SupplyOffchainProperties,
        configuration: GeneralLib.Configuration.Entity): Promise<Entity> => {
        const supply = new Entity(null, configuration);

        const offChainStorageProperties =
            supply.prepareEntityCreation(
                supplyPropertiesOnChain,
                supplyPropertiesOffChain,
                SupplyOffchainpropertiesSchema,
                supply.getUrl());
        if (configuration.offChainDataSource) {
            supplyPropertiesOnChain.url = supply.getUrl();
            supplyPropertiesOnChain.propertiesDocumentHash = offChainStorageProperties.rootHash;
        }

        const tx = await configuration.blockchainProperties.marketLogicInstance.createSupply(
            supplyPropertiesOnChain.propertiesDocumentHash,
            supplyPropertiesOnChain.url,
            supplyPropertiesOnChain.assetId,
            {
                from: configuration.blockchainProperties.activeUser.address,
                privateKey: configuration.blockchainProperties.activeUser.privateKey,
            },
        );

        supply.id = configuration.blockchainProperties.web3.utils.hexToNumber(tx.logs[0].topics[1]).toString();

        await supply.putToOffChainStorage(supplyPropertiesOffChain, offChainStorageProperties);

        configuration.logger.info(`Supply ${supply.id} created`);

        return supply.sync();

    };

export class Entity extends GeneralLib.BlockchainDataModelEntity.Entity implements SupplyOnChainProperties {

    offChainProperties: SupplyOffchainProperties;
    propertiesDocumentHash: string;
    url: string;

    assetId: number;

    initialized: boolean;
    configuration: GeneralLib.Configuration.Entity;

    constructor(id: string, configuration: GeneralLib.Configuration.Entity) {
        super(id, configuration);

        this.initialized = false;
    }

    getUrl(): string {
        return `${this.configuration.offChainDataSource.baseUrl}/Supply`;
    }

    async sync(): Promise<Entity> {
        if (this.id != null) {
            const demand = await this.configuration.blockchainProperties.marketLogicInstance.getSupply(this.id);

            this.propertiesDocumentHash = demand._propertiesDocumentHash;
            this.url = demand._documentDBURL;
            this.assetId = demand._assetId;
            this.initialized = true;

            this.offChainProperties = await this.getOffChainProperties(this.propertiesDocumentHash);

            if (this.configuration.logger) {
                this.configuration.logger.verbose(`Supply ${this.id} synced`);
            }

        }
        return this;

    }
}