import * as GeneralLib from 'ew-utils-general-lib';

export interface DemandOnChainProperties {
    demandOnChain: GeneralLib.BlockchainDataModelEntity.OnChainProperties;
    demandOwner: string;
}

export interface SupplyOnChainProperties {
    supplyOnChain: GeneralLib.BlockchainDataModelEntity.OnChainProperties;
    assetId: number;
}

export class Entity extends GeneralLib.BlockchainDataModelEntity.Entity implements DemandOnChainProperties, SupplyOnChainProperties {

    demandOnChain: GeneralLib.BlockchainDataModelEntity.OnChainProperties;
    demandOwner: string;

    supplyOnChain: GeneralLib.BlockchainDataModelEntity.OnChainProperties;
    assetId: number;

    initialized: boolean;
    configuration: GeneralLib.Configuration.Entity;

    constructor(id: string, configuration: GeneralLib.Configuration.Entity) {
        super(id, configuration);

        this.initialized = false;
    }

    getUrl(): string {
        return `${this.configuration.offChainDataSource.baseUrl}/Agreement`;
    }

    async sync(): Promise<Entity> {
        if (this.id != null) {
            const agreement = await this.configuration.blockchainProperties.demandLogicInstance.getAgreement(this.id);

            /*
            this.propertiesDocumentHash = agreement._propertiesDocumentHash;
            this.documentDBURL = agreement._documentDBURL;
            this.demandId = agreement._demandId;
            this.supplyId = agreement._supplyId;
            this.approvedBySupplyOwner = agreement._approvedBySupplyOwner;
            this.approvedBySupplyOwner = agreement._approvedByDemandOwner;
            */
        }
        return this;

    }
}