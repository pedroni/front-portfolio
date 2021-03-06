import { last, orderBy } from 'lodash'
import { isAuthenticated } from '../../auth'
import { databaseConnection } from '../../database'

const post = async (req, res) => {
  try {
    const database = await databaseConnection()
    const { name, email, subject } = req.body
    const collection = database.collection('contact')
    if (!name) {
      return res.status(400).json({
        message: 'Por gentileza, informe seu nome.'
      })
    }
    if (!email) {
      return res.status(400).json({
        message: 'Por gentileza, informe seu e-mail.'
      })
    }
    if (!subject) {
      return res.status(400).json({
        message: 'Por gentileza, informe sobre o que você gostaria de conversar.'
      })
    }
    const exists = await collection.findOne({
      email
    })
    if (exists) {
      await collection.update({
        email
      }, {
        $set: {
          messages: [
            ...(exists.messages ?? []),
            {
              subject,
              name,
              createdAt: new Date()
            }
          ]
        }
      })
    } else {
      await collection.insertOne({
        email,
        messages: [
          {
            subject,
            name,
            createdAt: new Date()
          }
        ]
      })
    }

    return res.status(200).json({
      message: 'Agradeço o contato! Sua mensagem foi enviada. \n Em breve entrarei em contato com você.',
      data: {
        name,
        email,
        subject,
        createdAt: new Date()
      }
    })
  } catch (err) {
    console.log(err)
    return res.status(500).json({
      message: 'Ops, não foi possível enviar a mensagem por aqui. Envie uma mensagem diretamente pelo WhatsApp ou LinkedIn'
    })
  }
}

export const get = async (req, res) => {
  const isAuth = await isAuthenticated({
    token: req.headers.authorization,
    roles: ['admin']
  })
  if (!isAuth) {
    return res.status(401).json({ message: 'not enough permissions to see this' })
  }
  const database = await databaseConnection()
  const collection = database.collection('contact')
  const contacts = await collection.find().sort({ 'messages.createdAt': -1 }).toArray()
  const messages = contacts.reduce((currentMessages, contact) => {
    contact.messages = orderBy(contact.messages.map(message => ({
      ...message,
      email: contact.email
    })), (message) => new Date(message.createdAt), 'desc')

    return [
      ...currentMessages,
      ...(contact.messages || [])
    ]
  }, [])
  const lastMessage = last(orderBy(messages, (message) => new Date(message.createdAt)))
  return res.status(200).json({
    data: contacts,
    statistics: {
      emailsCount: contacts.length,
      messagesCount: messages.length,
      lastMessage
    }
  })
}

export default (req, res) => {
  if (req.method === 'POST') {
    return post(req, res)
  } else if (req.method === 'GET') {
    return get(req, res)
  } else {
    return res.status(405)
  }
}
