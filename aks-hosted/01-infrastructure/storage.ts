import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";
import { Output } from "@pulumi/pulumi";

export interface StorageArgs {
    resourceGroupName: Output<string>,
    tags?: pulumi.Input<{
        [key: string]: pulumi.Input<string>;
    }>,
};

export class Storage extends pulumi.ComponentResource {
    public readonly storageAccountId: Output<string>;
    public readonly storageAccountName: Output<string>;
    public readonly storageAccountKey1: Output<string>;
    public readonly storageAccountKey2: Output<string>;
    public readonly checkpointBlobId: Output<string>;
    public readonly policyBlobId: Output<string>;
    public readonly checkpointBlobName: Output<string>;
    public readonly policyBlobName: Output<string>;
    constructor(name: string, args: StorageArgs) {
        super("x:infrastructure:storage", name);

        // Uses a different resource name because of Azure's 24 character limit and global unique name requirements
        const storageAccount = new azure.storage.StorageAccount("pulumi", {
            resourceGroupName: args.resourceGroupName,
            sku: {
                name: azure.storage.v20190601.SkuName.Standard_LRS,
            },
            kind: azure.storage.v20190601.Kind.StorageV2,
            tags: args.tags,
        }, {parent: this, protect: true});

        const checkpointBlob = new azure.storage.BlobContainer(`pulumicheckpoints`, {
            resourceGroupName: args.resourceGroupName,
            accountName: storageAccount.name,
        }, {parent: storageAccount, protect: true});
        
        const policyBlob = new azure.storage.BlobContainer(`pulumipolicypacks`, {
            resourceGroupName: args.resourceGroupName,
            accountName: storageAccount.name,
        }, {parent: storageAccount, protect: true});

        const storageAccountKeys = pulumi
            .all([args.resourceGroupName, storageAccount.name])
            .apply(([resourceGroupName, accountName]) =>
                azure.storage.v20190601.listStorageAccountKeys({ resourceGroupName, accountName })
            );

        this.storageAccountKey1 = pulumi.secret(storageAccountKeys.keys[0].value);
        this.storageAccountKey2 = pulumi.secret(storageAccountKeys.keys[1].value);
        this.checkpointBlobId = checkpointBlob.id;
        this.policyBlobId = policyBlob.id;
        this.storageAccountId = storageAccount.id
        this.checkpointBlobName = checkpointBlob.name;
        this.policyBlobName = policyBlob.name;
        this.storageAccountName = storageAccount.name;
        
        this.registerOutputs({
            storageAccountId: this.storageAccountId,
            storageAccountKey1: this.storageAccountKey1,
            storageAccountKey2: this.storageAccountKey2,
            checkpointBlobId: this.checkpointBlobId,
            policyBlobId: this.policyBlobId,
            checkpointBlobName: this.checkpointBlobName,
            policyBlogName: this.policyBlobName,
            storageAccountName: this.storageAccountName
        });
    }
}
