import * as azure from "@pulumi/azure-native";
import * as random from "@pulumi/random";
import * as pulumi from "@pulumi/pulumi";
import { Output, ComponentResourceOptions } from "@pulumi/pulumi";

export interface DatabaseArgs {
    resourceGroupName: Output<string>,
    subnetId: Output<string>,
    tags?: pulumi.Input<{
        [key: string]: pulumi.Input<string>;
    }>,
}

export class Database extends pulumi.ComponentResource {
    DatabaseConnectionString: Output<string | undefined>;
    DatabaseLogin: Output<string | undefined>;
    DatabasePassword: Output<string>;
    DatabaseName: Output<string>;
    DatabaseServerName: Output<string>;
    constructor(name: string, args: DatabaseArgs, opts?: ComponentResourceOptions) {
        super("x:infrastructure:database", name, opts);

        const dbPassword = new random.RandomPassword(`${name}-dbpassword`, {
            length: 20,
            lower: true,
            upper: true,
            special: true,
        }, {
            parent: this,
            additionalSecretOutputs: ["result"], 
        });

        const server = new azure.dbformysql.Server(`${name}-mysql`, {
            resourceGroupName: args.resourceGroupName,

            properties: {
                administratorLogin: "pulumiadmin",
                administratorLoginPassword: dbPassword.result,
                createMode: "Default",
                infrastructureEncryption: "Disabled",
                minimalTlsVersion: "TLSEnforcementDisabled",
                publicNetworkAccess: "Enabled",
                sslEnforcement: "Disabled",
                storageProfile: {
                    backupRetentionDays: 7,
                    geoRedundantBackup: "Disabled",
                    storageAutogrow: "Enabled",
                    storageMB: 51200,
                },
                version: "5.7",
            },
            sku: {
                capacity: 4,
                family: "Gen5",
                name: "GP_Gen5_4",
                tier: "GeneralPurpose",
            },
            tags: args.tags,
        }, {
            protect: true,
            parent: this
        });

        // https://docs.microsoft.com/en-us/azure/mysql/howto-troubleshoot-common-errors#error-1419-you-do-not-have-the-super-privilege-and-binary-logging-is-enabled-you-might-want-to-use-the-less-safe-log_bin_trust_function_creators-variable
        const configuration = new azure.dbformysql.Configuration(`${name}-config`, {
            resourceGroupName: args.resourceGroupName,

            serverName: server.name,
            source: "user-override",
            configurationName: "log_bin_trust_function_creators",
            value: "ON",
        }, {parent: server});
        
        const vnetRule = new azure.dbformysql.VirtualNetworkRule(`${name}-dbvnetrule`, {
            resourceGroupName: args.resourceGroupName,

            serverName: server.name,
            virtualNetworkSubnetId: args.subnetId,
        }, {parent: server});

        const db = new azure.dbformysql.Database(`${name}-mysql`, {
            databaseName: "pulumi", // Must be named "pulumi".
            resourceGroupName: args.resourceGroupName,
            
            serverName: server.name,
        }, {
            parent: server,
            protect: true, 
        });

        this.DatabaseConnectionString = server.fullyQualifiedDomainName;
        this.DatabaseLogin = server.administratorLogin;
        this.DatabasePassword = dbPassword.result;
        this.DatabaseName = db.name;
        this.DatabaseServerName = server.name;
        this.registerOutputs({
            DatabaseConnectionString: this.DatabaseConnectionString,
            DatabaseLogin: this.DatabaseLogin,
            DatabasePassword: this.DatabasePassword,
            DatabaseName: this.DatabaseName,
            DatabaseServerName: this.DatabaseServerName,
        });
    }
}
