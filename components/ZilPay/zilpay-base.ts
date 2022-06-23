import * as tyron from 'tyron'
import { ZIlPayInject } from '../../src/types/zil-pay'
import * as zutil from '@zilliqa-js/util'
import { operationKeyPair } from '../../src/lib/dkms'

type Params = {
    contractAddress: string
    transition: string
    params: Record<string, unknown>[]
    amount: string
}

const window = global.window as any
const DEFAULT_GAS = {
    gasPrice: '2000',
    gaslimit: '10000',
}

export class ZilPayBase {
    public zilpay: () => Promise<ZIlPayInject>
    constructor() {
        this.zilpay = () =>
            new Promise((resolve, reject) => {
                if (!(process as any).browser) {
                    return resolve({} as any)
                }
                let k = 0
                const i = setInterval(() => {
                    if (k >= 10) {
                        clearInterval(i)
                        return reject(new Error('ZilPay is not installed.'))
                    }

                    if (typeof window['zilPay'] !== 'undefined') {
                        clearInterval(i)
                        return resolve(window['zilPay'])
                    }

                    k++
                }, 100)
            })
    }

    async getSubState(contract: string, field: string, params: string[] = []) {
        if (!(process as any).browser) {
            return null
        }

        const zilPay = await this.zilpay()
        const res = await zilPay.blockchain.getSmartContractSubState(
            contract,
            field,
            params
        )

        if (res.error) {
            throw new Error(res.error.message)
        }

        if (res.result && res.result[field] && params.length === 0) {
            return res.result[field]
        }

        if (res.result && res.result[field] && params.length === 1) {
            const [arg] = params
            return res.result[field][arg]
        }

        if (res.result && res.result[field] && params.length > 1) {
            return res.result[field]
        }

        return null
    }

    async getState(contract: string) {
        if (!(process as any).browser) {
            return null
        }
        const zilPay = await this.zilpay()
        const res = await zilPay.blockchain.getSmartContractState(contract)

        if (res.error) {
            throw new Error(res.error.message)
        }

        return res.result
    }

    async getBlockchainInfo() {
        if (!(process as any).browser) {
            return null
        }

        const zilPay = await this.zilpay()
        const { error, result } = await zilPay.blockchain.getBlockChainInfo()

        if (error) {
            throw new Error(error.message)
        }

        return result
    }

    async call(data: Params, gas?: any) {
        let this_gas = DEFAULT_GAS
        if (gas !== undefined) {
            this_gas = gas
        }
        const zilPay = await this.zilpay()
        const { contracts, utils } = zilPay
        const contract = contracts.at(data.contractAddress)
        const gasPrice = utils.units.toQa(
            this_gas.gasPrice,
            utils.units.Units.Li
        )
        const gasLimit = utils.Long.fromNumber(this_gas.gaslimit)
        const amount_ = zutil.units.toQa(data.amount, zutil.units.Units.Zil)

        const amount = amount_ || '0'

        return await contract.call(data.transition, data.params, {
            amount,
            gasPrice,
            gasLimit,
        })
    }

    async deployDid(net: string, address: string, arConnect: any) {
        try {
            const zilPay = await this.zilpay()
            const { contracts } = zilPay

            //mainnet addresses
            let XWALLET = '0x4f64daa860b19d5ac7b3552917c385ca0b6075c7'
            let xInit = '0x2d7e1a96ac0592cd1ac2c58aa1662de6fe71c5b9'

            if (net === 'testnet') {
                XWALLET = '0xadd4b95f32f3aa4d23f19746ebf9fb87d20c82fb'
                xInit = '0xec194d20eab90cfab70ead073d742830d3d2a91b' //@todo-x
            }
            const xwallet = contracts.at(XWALLET)
            const code = await xwallet.getCode()

            let verification_methods: any = []
            if (arConnect !== null) {
                const key_input = [
                    {
                        id: tyron.VerificationMethods.PublicKeyPurpose.Update,
                    },
                    {
                        id: tyron.VerificationMethods.PublicKeyPurpose
                            .SocialRecovery,
                    },
                    {
                        id: tyron.VerificationMethods.PublicKeyPurpose.General,
                    },
                    {
                        id: tyron.VerificationMethods.PublicKeyPurpose.Auth,
                    },
                    {
                        id: tyron.VerificationMethods.PublicKeyPurpose
                            .Assertion,
                    },
                    {
                        id: tyron.VerificationMethods.PublicKeyPurpose
                            .Agreement,
                    },
                    {
                        id: tyron.VerificationMethods.PublicKeyPurpose
                            .Invocation,
                    },
                    {
                        id: tyron.VerificationMethods.PublicKeyPurpose
                            .Delegation,
                    },
                ]
                for (const input of key_input) {
                    // Creates the cryptographic DID key pair
                    const doc = await operationKeyPair({
                        arConnect: arConnect,
                        id: input.id,
                        addr: address,
                    })
                    verification_methods.push(doc.element.key)
                }
            } else {
                throw new Error('Connect your Arweave wallet to continue.')
            }

            const did_methods: Array<{ key: string; val: string }> = []
            const did_dkms: Array<{ key: string; val: string }> = []

            for (let i = 0; i < verification_methods.length; i += 1) {
                did_methods.push({
                    key: verification_methods[i].id,
                    val: verification_methods[i].key,
                })
                did_dkms.push({
                    key: verification_methods[i].id,
                    val: verification_methods[i].encrypted,
                })
            }
            // did_methods.push(
            //   {
            //     key: `${"null"}`,
            //     val: `${"0x000000000000000000000000000000000000000000000000000000000000000000"}`,
            //   }
            // );
            // did_dkms.push(
            //   {
            //     key: `${"null"}`,
            //     val: `${"null"}`,
            //   }
            // );

            const init = [
                {
                    vname: '_scilla_version',
                    type: 'Uint32',
                    value: '0',
                },
                {
                    vname: 'init_controller',
                    type: 'ByStr20',
                    value: `${address}`,
                },
                {
                    vname: 'init',
                    type: 'ByStr20',
                    value: `${xInit}`,
                },
                {
                    vname: 'did_methods',
                    type: 'Map String ByStr33',
                    value: did_methods,
                },
                {
                    vname: 'did_dkms',
                    type: 'Map String String',
                    value: did_dkms,
                },
            ]
            const contract = contracts.new(code, init)
            const [tx, deployed_contract] = await contract.deploy({
                gasLimit: '45000',
                gasPrice: '2000000000',
            })
            return [tx, deployed_contract]
        } catch (error) {
            throw error
        }
    }

    async deployDomain(net: string, domain: string, address: string) {
        try {
            const zilPay = await this.zilpay()
            const { contracts } = zilPay
            let addr = ''

            // mainnet
            switch (domain) {
                case 'vc':
                    addr = '0x6ae25f8df1f7f3fae9b8f9630e323b456c945e88'
                    break
                case 'ssi':
                    addr = ''
                    break
            }
            if (net === 'testnet') {
                switch (domain) {
                    case 'vc':
                        addr = '0x25B4B343ba84D53c2f9Db964Fd966BB1a579EF25'
                        break
                    case 'ssi':
                        addr = 'zil1jnc7wsynp4q9cvtmrkeea9eu2qmyvwdy8dxl53'
                        break
                }
            }

            const template = contracts.at(addr)
            const code = await template.getCode()

            const init = [
                {
                    vname: '_scilla_version',
                    type: 'Uint32',
                    value: '0',
                },
                {
                    vname: 'init_controller',
                    type: 'ByStr20',
                    value: `${address}`,
                },
            ]

            const contract = contracts.new(code, init)
            const [tx, deployed_contract] = await contract.deploy({
                gasLimit: '35000',
                gasPrice: '2000000000',
            })
            return [tx, deployed_contract]
        } catch (error) {
            throw error
        }
    }
}
