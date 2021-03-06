import { combineReducers } from 'redux'

import { Device } from '../../../common/models/DataTypes'
import { TagType, TagId, TagById } from '../../../common/models/Tag'
import { PhotoSection, PhotoSectionId, PhotoById, PhotoSectionById } from '../../../common/models/Photo'
import { cloneArrayWithItemRemoved } from '../../../common/util/LangUtil'

import { Action } from '../ActionType'
import {
    FETCH_TOTAL_PHOTO_COUNT, FETCH_SECTIONS_REQUEST, FETCH_SECTIONS_SUCCESS, FETCH_SECTIONS_FAILURE, CHANGE_PHOTOS, EMPTY_TRASH,
    FETCH_DATES, FETCH_TAGS, SET_PHOTO_TAGS, INIT_DEVICES, ADD_DEVICE, REMOVE_DEVICE, FORGET_SECTION_PHOTOS, FETCH_SECTION_PHOTOS
} from '../actionTypes'
import { FetchState } from '../../UITypes'


type TagsState = {
    readonly ids: TagId[]
    readonly byId: TagById
}

const initialTagsState: TagsState = {
    ids: [],
    byId: {}
}

const tags = (state: TagsState = initialTagsState, action: Action): TagsState => {
    switch (action.type) {
        case FETCH_TAGS: {
            let ids: TagId[] = []
            let byId: TagById = {}
            for (const tag of action.payload.tags) {
                ids.push(tag.id)
                byId[tag.id] = tag
            }
            return { ids, byId }
        }
        default:
            return state
    }
}


type DevicesState = Device[]

const devices = (state: DevicesState = [], action: Action): DevicesState => {
    switch (action.type) {
        case INIT_DEVICES:
            return [ ...action.payload.devices ]
        case ADD_DEVICE:
            return [
                ...state,
                action.payload.device
            ]
        case REMOVE_DEVICE:
            return cloneArrayWithItemRemoved(state, action.payload.device, 'id')
        default:
            return state
    }
}


export type DatesState = {
    readonly years: {
        /** E.g. '2018' or 'Invalid date' */
        readonly id: string
        readonly months: {
            /** E.g. '06' or 'Invalid date' */
            readonly id: string
            readonly days: {
                /** E.g. '2018-06-23' or 'Invalid date' */
                readonly id: string
            }[]
        }[]
    }[]
}

const initialDatesState: DatesState = { years: [] }

const dates = (state: DatesState = initialDatesState, action: Action): DatesState => {
    switch (action.type) {
        case FETCH_DATES:
            return action.payload.dates
        default:
            return state
    }
}


type SectionsState = {
    readonly fetchState: FetchState
    /** The total number of photos (when no filter is applied). Is null before fetched for the first time. */
    readonly totalPhotoCount: number | null
    /** The number of photos with the current filter applied */
    readonly photoCount: number
    readonly ids: PhotoSectionId[]
    readonly byId: PhotoSectionById
}

const initialSectionsState: SectionsState = {
    fetchState: FetchState.IDLE,
    totalPhotoCount: null,
    photoCount: 0,
    ids: [],
    byId: {}
}

const sections = (state: SectionsState = initialSectionsState, action: Action): SectionsState => {
    switch (action.type) {
        case FETCH_TOTAL_PHOTO_COUNT:
            return {
                ...state,
                totalPhotoCount: action.payload.totalPhotoCount
            }
        case FETCH_SECTIONS_REQUEST:
            return {
                ...state,  // We keep the old photos while loading
                fetchState: FetchState.FETCHING
            }
        case FETCH_SECTIONS_SUCCESS: {
            let photoCount = 0
            let ids = []
            let byId = {}
            for (const section of action.payload.sections) {
                photoCount += section.count
                ids.push(section.id)
                byId[section.id] = section
            }

            return {
                ...state,
                fetchState: FetchState.IDLE,
                photoCount,
                ids,
                byId
            }
        }
        case FETCH_SECTIONS_FAILURE:
            return {
                ...state,  // We keep the old photos
                fetchState: FetchState.FAILURE
            }
        case FETCH_SECTION_PHOTOS: {
            const sectionId = action.payload.sectionId
            const prevSection = state.byId[sectionId]
            if (prevSection) {
                let photoIds = []
                let photoData = {}
                for (const photo of action.payload.photos) {
                    photoIds.push(photo.id)
                    photoData[photo.id] = photo
                }

                return {
                    ...state,
                    byId: {
                        ...state.byId,
                        [sectionId]: {
                            ...prevSection,
                            count: photoIds.length,  // Should be correct already, but we set it just in case
                            photoIds,
                            photoData
                        }
                    }
                }
            } else {
                return state
            }
        }
        case FORGET_SECTION_PHOTOS: {
            const sectionIdsToForget = action.payload.sectionIds
            let newSectionById = {}
            for (const sectionId of state.ids) {
                const prevSection = state.byId[sectionId]
                newSectionById[sectionId] = sectionIdsToForget[sectionId] ?
                    {
                        id: prevSection.id,
                        title: prevSection.title,
                        count: prevSection.count
                    } :
                    prevSection
            }

            return {
                ...state,
                byId: newSectionById
            }
        }
        case CHANGE_PHOTOS: {
            const updatedPhotos = action.payload.photos
            const removeUpdatedPhotos = action.payload.update.trashed !== undefined
                // The trashed state has changed. So either a photos were moved to trash or they were recovered from trash
                // In both cases the photos should be removed from the currently shown photos

            let totalPhotoCount = state.totalPhotoCount
            let photoCount = state.photoCount
            let newSectionIds = []
            let newSectionById = {}
            for (const sectionId of state.ids) {
                const section = state.byId[sectionId]
                let newSection: PhotoSection

                const photoData = section.photoData
                if (photoData) {
                    let newPhotoData: PhotoById
                    for (const updatedPhoto of updatedPhotos) {
                        const prevPhoto = photoData[updatedPhoto.id]
                        if (prevPhoto) {
                            if (!newPhotoData) {
                                newPhotoData = { ...photoData }
                                newSection = { ...section, photoData: newPhotoData }
                            }
                            if (removeUpdatedPhotos) {
                                const prevPhotoIndex = newSection.photoIds.indexOf(prevPhoto.id)
                                if (prevPhotoIndex !== -1) {
                                    newSection.photoIds.splice(prevPhotoIndex, 1)
                                }
                                if (action.payload.update.trashed) {
                                    totalPhotoCount--
                                }
                                newSection.count--
                                photoCount--
                            } else {
                                newPhotoData[updatedPhoto.id] = updatedPhoto
                            }
                        }
                    }
                }

                if (!newSection || newSection.photoIds.length !== 0) {
                    newSectionIds.push(sectionId)
                    newSectionById[sectionId] = newSection || section
                }
            }

            return {
                ...state,
                totalPhotoCount,
                photoCount,
                ids: newSectionIds,
                byId: newSectionById
            }
        }
        case EMPTY_TRASH:
            return {
                ...state,
                photoCount: 0,
                ids: [],
                byId: {}
            }
        default:
            return state
    }
}


export type DataState = {
    readonly tags: TagsState
    readonly devices: DevicesState
    readonly dates: DatesState
    readonly sections: SectionsState
}

export const data = combineReducers<DataState>({
    tags,
    devices,
    dates,
    sections
})
