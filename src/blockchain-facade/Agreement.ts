import * as GeneralLib from 'ew-utils-general-lib';
import { timingSafeEqual } from 'crypto';

export interface AgreementOnChainProperties {
    propertiesDocumentHash: string;
    documentDBURL: string;
    demandId: number;
    supplyId: number;
    approvedBySupplyOwner: boolean;
    approvedByDemandOwner: boolean;
}

export abstract class Entity extends GeneralLib.BlockchainDataModelEntity.Entity implements AgreementOnChainProperties {

    propertiesDocumentHash: string;
    documentDBURL: string;
    demandId: number;
    supplyId: number;
    approvedBySupplyOwner: boolean;
    approvedByDemandOwner: boolean;

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

            this.propertiesDocumentHash = agreement._propertiesDocumentHash;
            this.documentDBURL = agreement._documentDBURL;
            this.demandId = agreement._demandId;
            this.supplyId = agreement._supplyId;
            this.approvedBySupplyOwner = agreement._approvedBySupplyOwner;
            this.approvedBySupplyOwner = agreement._approvedByDemandOwner;
        }
        return this;

    }
}