require("dotenv").config();
require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");
require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-dependency-compiler");

DEFAULT_MNEMONIC = "test test test test test test test test test test test test";
DEFAULT_PVTKEY = "0x65b80d37f35356f1475134121b9e04ba0e9ed4505c34990339a4f4a3a1816968"; // Test private key

task("accounts", "Prints the list of accounts", async () => {
    const accounts = await ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    dependencyCompiler: {
        paths: [
            "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol",
            "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol",
            "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol",
        ], // ,
        // keep: true
    },
    solidity: {
        compilers: [
            {
                version: "0.8.9",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
            {
                version: "0.8.6",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
            {
                version: "0.5.16",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
        ],
    },
    networks: {
        ropsten: {
            url: `https://ropsten.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
            accounts: {
                mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 20,
            },
        },
        goerli: {
            url: `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
            accounts: {
                mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 20,
            },
        },
        rinkeby: {
            url: `https://rinkeby.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
            accounts: {
                mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 20,
            },
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
            accounts: {
                mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 20,
            },
        },
        lukso: {
            url: `https://rpc.mainnet.lukso.network`,
            accounts: {
                mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 20,
            },
        },
        gnosis: {
            url: `https://rpc.gnosischain.com`,
            accounts: [`${process.env.PRIVATE_KEY_XDAI || DEFAULT_PVTKEY}`],
        },
    },
    etherscan: {
        apiKey: {
            chiado: `${process.env.ETHERSCAN_API_KEY}`,
            gnosis: `${process.env.GNOSISCAN_API_KEY}`,
            lukso: `${process.env.ETHERSCAN_API_KEY}`,
        },
        customChains: [
            {
                network: "gnosis",
                chainId: 100,
                urls: {
                    apiURL: "https://api.gnosisscan.io/api",
                    browserURL: "https://gnosisscan.io/",
                },
            },
            {
                network: "lukso",
                chainId: 42,
                urls: {
                    apiURL: "https://explorer.execution.mainnet.lukso.network/api",
                    browserURL: "https://explorer.execution.mainnet.lukso.network",
                },
            },
        ],
    },
};
