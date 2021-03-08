import * as url from 'url'
import { Readable } from 'stream'
import * as https from 'https'
import { ClientRequest, IncomingMessage } from 'http'
import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

import { EnvironmentConfig } from '..'
import { sha256 } from '../lib/crypto'
import { ExchangeReport, ExchangeReportParams } from '../api/reports'

import { ShardMeta } from '../lib/shardMeta'
import { ContractNegotiated } from '../lib/contracts'
import * as dotenv from 'dotenv'
import { Shard } from '../api/shard'
dotenv.config({ path: '/home/inxt/inxt-js/.env' })

const INXT_API_URL = process.env.INXT_API_URL

export async function request(config: EnvironmentConfig, method: AxiosRequestConfig['method'], targetUrl: string, params: AxiosRequestConfig): Promise<AxiosResponse<JSON>> {
  const DefaultOptions: AxiosRequestConfig = {
    method: method,
    auth: {
      username: config.bridgeUser,
      password: sha256(Buffer.from(config.bridgePass)).toString('hex')
    },
    url: targetUrl
  }

  const options = { ...DefaultOptions, ...params }

  return axios.request<JSON>(options)
}

export function streamRequest(targetUrl: string, nodeID: string): Readable {
  const uriParts = url.parse(targetUrl)
  let downloader: ClientRequest | null = null

  function _createDownloadStream(): ClientRequest {
    new https.Agent({ keepAlive: true, keepAliveMsecs: 25000 })

    return https.get({
      protocol: uriParts.protocol,
      hostname: uriParts.hostname,
      port: uriParts.port,
      path: uriParts.path,
      headers: {
        'content-type': 'application/octet-stream',
        'x-storj-node-id': nodeID
      }
    })
  }

  return new Readable({
    read: function () {
      if (!downloader) {
        downloader = _createDownloadStream()
        downloader.on('response', (res: IncomingMessage) => {
          res
            .on('data', this.push.bind(this))
            .on('error', this.emit.bind(this, 'error'))
            .on('end', () => {
              this.push.bind(this, null)
              this.emit('end')
            }).on('close', this.emit.bind(this, 'close'))
        }).on('error', this.emit.bind(this, 'error'))
      }
    }
  })
}

export function extractErrorMsg(err: AxiosError) : Promise<any> {
  if(err.response) {
    return Promise.reject({
      err: err.response, 
      message: err.response.data.error ? err.response.data.error : err.response.data.result,
      status: err.response.status
    })
  } else {
    throw new Error('empty error message')
  }
}

interface getBucketByIdResponse {
  user: string,
  encryptionKey: string,
  publicPermissions: string[],
  created: string,
  name: string,
  pubkeys: string[],
  status: 'Active' | 'Inactive',
  transfer: number,
  storage: number,
  id: string
}

/**
 * Checks if a bucket exists given its id
 * @param config App config
 * @param bucketId
 * @param token
 * @param jwt JSON Web Token
 * @param params
 */
export function getBucketById(config: EnvironmentConfig, bucketId: string, params?: AxiosRequestConfig): Promise<getBucketByIdResponse | void> {
  const URL = config.bridgeUrl ? config.bridgeUrl : INXT_API_URL
  const targetUrl = `${URL}/buckets/${bucketId}`
  const defParams: AxiosRequestConfig = {
    headers: {
      'User-Agent': 'libstorj-2.0.0-beta2',
      'Content-Type': 'application/octet-stream',
    }
  }

  const finalParams = { ...defParams, ...params }

  return request(config, 'get', targetUrl, finalParams)
    .then<getBucketByIdResponse>((res: AxiosResponse) => res.data)
    .catch(extractErrorMsg)
}

interface getFileByIdResponse {
  /* file-id */
  id: string
}

/**
 * Checks if a file exists given its id and a bucketId
 * @param config App config
 * @param bucketId
 * @param fileId
 * @param jwt JSON Web Token
 * @param params
 */
export function getFileById(config: EnvironmentConfig, bucketId: string, fileId:string, params?: AxiosRequestConfig): Promise<getFileByIdResponse | void> {
  const URL = config.bridgeUrl ? config.bridgeUrl : INXT_API_URL
  const targetUrl = `${URL}/buckets/${bucketId}/file-ids/${fileId}`
  const defParams: AxiosRequestConfig = {
    headers: {
      'User-Agent': 'libstorj-2.0.0-beta2',
      'Content-Type': 'application/octet-stream',
    }
  }

  const finalParams = { ...defParams, ...params }

  return request(config, 'get', targetUrl, finalParams)
    .then<getFileByIdResponse>((res: AxiosResponse) => res.data)
    .catch(extractErrorMsg)
}

export interface FrameStaging {
  /* frame id */
  id: string,
  /* user email */
  user: string,
  shards: [],
  storageSize: number,
  /* frame size */
  size: number,
  locked: boolean,
  /* created timestamp stringified */
  created: string,
}

/**
 * Creates a file staging frame
 * @param config App config
 * @param params
 */
export function createFrame(config: EnvironmentConfig, params?: AxiosRequestConfig): Promise <FrameStaging> {
  const URL = config.bridgeUrl ? config.bridgeUrl : INXT_API_URL
  const targetUrl = `${URL}/frames`
  const defParams: AxiosRequestConfig = {
    headers: {
      'User-Agent': 'libstorj-2.0.0-beta2',
      'Content-Type': 'application/octet-stream',
    }
  }

  const finalParams = { ...defParams, ...params }

  return request(config, 'post', targetUrl, finalParams)
    .then<FrameStaging>((res: AxiosResponse) => res.data)
    .catch(extractErrorMsg)
}

export interface CreateEntryFromFrameBody {
  frame: string,
  filename: string,
  index: string,
  hmac: {
    type: string,
    value: string
  }
}

export interface CreateEntryFromFrameResponse {
  /* bucket entry id */
  id: string,
  index: string,
  /* frame id */
  frame: string,
  /* bucket id */
  bucket: string,
  mimetype: string
  name: string,
  renewal: string,
  created: string,
  hmac: {
    value: string,
    type: string
  },
  erasure: {
    type: string
  },
  size: number
}

/**
 * Creates a bucket entry from the given frame object
 * @param {EnvironmentConfig} config App config
 * @param {string} bucketId
 * @param {CreateEntryFromFrameBody} body
 * @param {string} jwt JSON Web Token
 * @param {AxiosRequestConfig} params
 */
export function createEntryFromFrame(config: EnvironmentConfig, bucketId: string, body: CreateEntryFromFrameBody, params?: AxiosRequestConfig): Promise <CreateEntryFromFrameResponse | void> {
  const URL = config.bridgeUrl ? config.bridgeUrl : INXT_API_URL
  const targetUrl = `${URL}/buckets/${bucketId}/files`
  const defParams: AxiosRequestConfig = {
    headers: {
      'User-Agent': 'libstorj-2.0.0-beta2',
      'Content-Type': 'application/octet-stream',
    },
    data: body
  }

  const finalParams = { ...defParams, ...params }

  return request(config, 'post', targetUrl, finalParams)
    .then<CreateEntryFromFrameResponse>((res: AxiosResponse) => res.data)
    .catch(extractErrorMsg)
}

interface AddShardToFrameBody {
  /* shard hash */
  hash: string,
  /* shard size */
  size: number,
  /* shard index */
  index: number,
  /* if exists a shard parity for this shard */
  parity: boolean,
  /* shard challenges */
  challenges: string[],
  tree: string[],
  /* nodes excluded from being the shard's node */
  exclude: string[]
}

/**
 * Negotiates a storage contract and adds the shard to the frame
 * @param {EnvironmentConfig} config App config
 * @param {string} frameId
 * @param {AddShardToFrameBody} body
 * @param {string} jwt JSON Web Token
 * @param {AxiosRequestConfig} params
 */
export function addShardToFrame(config: EnvironmentConfig, frameId: string, body: ShardMeta, params?: AxiosRequestConfig): Promise <ContractNegotiated | void> {
  const URL = config.bridgeUrl ? config.bridgeUrl : INXT_API_URL
  const targetUrl = `${URL}/frames/${frameId}`
  const defParams: AxiosRequestConfig = {
    headers: {
      'User-Agent': 'libstorj-2.0.0-beta2',
      'Content-Type': 'application/octet-stream',
    },
    data: { ...body, challenges: body.challenges_as_str }
  }

  const finalParams = { ...defParams, ...params }

  return request(config, 'put', targetUrl, finalParams)
    .then<ContractNegotiated>((res: AxiosResponse) => res.data)
    .catch(extractErrorMsg)
}

/**
 * Sends an upload exchange report
 * @param config App config
 * @param body
 */
export function sendUploadExchangeReport(config: EnvironmentConfig, exchangeReport: ExchangeReport): Promise<AxiosResponse<JSON>> {
  return exchangeReport.sendReport()
    .catch(extractErrorMsg)
}

interface SendShardToNodeResponse {
  result: string
}

/**
 * Stores a shard in a node
 * @param config App config
 * @param shard Interface that has the contact info
 * @param content Buffer with shard content
 */
export function sendShardToNode(config: EnvironmentConfig, shard: Shard, content: Buffer):Promise<SendShardToNodeResponse | void> {
  const targetUrl = `http://${shard.farmer.address}:${shard.farmer.port}/shards/${shard.hash}?token=${shard.token}`

  console.log(content.byteLength)
  // console.log('target', targetUrl)
  const defParams: AxiosRequestConfig = {
    headers: {
      'User-Agent': 'libstorj-2.0.0-beta2',
      'Content-Type': 'application/octet-stream',
      'x-storj-node-id': shard.farmer.nodeID,
    },
    data: content
  }

  return request(config, 'post', targetUrl, defParams)
    .then<SendShardToNodeResponse>((res: AxiosResponse) => res.data)
    .catch(extractErrorMsg)
}