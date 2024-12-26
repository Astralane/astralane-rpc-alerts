const file_system = require("fs")
const path = require("path")

const base_url = "https://api.mainnet-beta.solana.com"
const file_path = path.resolve(__dirname, "./downtime.log")
const discord_webhook =
    "https://discord.com/api/webhooks/1303019850402238528/Y_LLT1hiGHxstFGBaqRcKrYDphl4XwTV_EbLbQXggd4y8gXf5KzRw9AKLI6CA5tteGM8"
const clusters_to_monitor = [
    "94rvXTFf7ZtKihLXrwp8e5mQmKVWLFG6aKqKzR3pYqF1",
    "9XKnHTDpFCR12FeWwbzHMsBNwbtNLrzWaApiVcjMqvzW",
    "CbvjseFvBqvBFz3Xe75iuA9vhkkFrjmnYSPx5AEcojwp"
]
//"A6q8636gVPZFHDj4kDUQVWArbQxwoymUkyrxAfV5nM3Z",
const downtime = new Map()

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
const get_cluster_node = async () => {
    let response

    await fetch(base_url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getClusterNodes",
        }),
    })
        .then((_response) => {
            if (_response.status === 200) {
                response = _response.json()
            } else {
                response = {}
            }
        })
        .catch((_error) => {
            console.error("Cluster Node Request Error: ", _error)
        })

    return response
}

const send_discord = async (_nodes, _is_down) => {
    let discord_body = {}

    if (_is_down) {
        discord_body = {
            username: "Cluster BOT!",
            embeds: [
                {
                    title: "Cluster ERROR!",
                    description: `These clusters are not active -> ${_nodes.join(
                        ",\n"
                    )}`,
                    color: 0xca4143,
                },
            ],
        }
    } else {
        discord_body = {
            username: "Cluster BOT!",
            embeds: [
                {
                    title: "Cluster INFO!",
                    description: `These clusters are active -> ${_nodes.join(
                        ",\n"
                    )}`,
                    color: 0x94fe95,
                },
            ],
        }
    }

    await fetch(discord_webhook, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(discord_body),
    })
        .then((_response) => {
            if (_response.status === 204) {
                console.log("Updating in Discord was successful.")
            }
        })
        .catch((_error) => {
            console.error(`Could not update to Discord!`)
        })
}

const main = async () => {
    clusters_to_monitor.forEach((_node) => {
        downtime.set(_node, {
            is_down: false,
            start_downtime: null,
        })
    })

    while (true) {
        const cluster_node = await get_cluster_node()

        let currently_got_down = [...clusters_to_monitor]

        if (cluster_node.result?.length > 0) {
            cluster_node.result.forEach((_node) => {
                if (clusters_to_monitor.includes(_node.pubkey)) {
                    const is_node_down = downtime.get(_node.pubkey).is_down
                    const start_node_downtime = downtime.get(
                        _node.pubkey
                    ).start_downtime

                    currently_got_down = currently_got_down.filter(
                        (_n) => _n !== _node.pubkey
                    )

                    if (is_node_down && start_node_downtime) {
                        const data_to_log = `${
                            _node.pubkey
                        }, ${start_node_downtime}, ${new Date().getTime()}\n`
                        file_system.appendFileSync(file_path, data_to_log, {
                            encoding: "utf-8",
                        })
                    }
                }
            })
        }

        // Got back up
        const got_back_up = new Array()
        downtime.forEach((_value, _key, _map) => {
            if (_value.is_down && !currently_got_down.includes(_key)) {
                got_back_up.push(_key)
                downtime.set(_key, {
                    is_down: false,
                    start_downtime: null,
                })
            }
        })
        got_back_up.length > 0 && send_discord(got_back_up, false)

        const d = new Date()
        console.info(
            `[${d.toLocaleDateString("en-IN", {
                dateStyle: "full",
            })}, ${d.toLocaleTimeString("en-IN", {
                timeStyle: "full",
            })}]: Currently down gossip pubkey are`,
            currently_got_down
        )

        currently_got_down.forEach((_node) => {
            const is_node_down = downtime.get(_node).is_down
            const start_node_downtime = downtime.get(_node).start_downtime

            if (!is_node_down && !start_node_downtime) {
                downtime.set(_node, {
                    is_down: true,
                    start_downtime: d.getTime(),
                })
            }
        })

        if (currently_got_down.length > 0)
            await send_discord(currently_got_down, true)

        await sleep(1000 * 60 * 5)
    }
}
main()
