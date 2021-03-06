import { create, fragment } from 'xmlbuilder2';

import {
  generateCoreXML,
  generateStylesXML,
  generateNumberingXMLTemplate,
  documentRelsXML as documentRelsXMLString,
  settingsXML as settingsXMLString,
  webSettingsXML as webSettingsXMLString,
  contentTypesXML as contentTypesXMLString,
  fontTableXML as fontTableXMLString,
} from './schemas';
import { convertVTreeToXML, namespaces } from './helpers';
import generateDocumentTemplate from '../template/document.template';

const crypto = require('crypto');

const landscapeMargins = {
  top: 1800,
  right: 1440,
  bottom: 1800,
  left: 1440,
  header: 720,
  footer: 720,
  gutter: 0,
};

const portraitMargins = {
  top: 1440,
  right: 1800,
  bottom: 1440,
  left: 1800,
  header: 720,
  footer: 720,
  gutter: 0,
};

class DocxDocument {
  constructor({
    zip,
    htmlString,
    orientation,
    margins,
    title,
    subject,
    creator,
    keywords,
    description,
    lastModifiedBy,
    revision,
    createdAt,
    modifiedAt,
    headerType,
    header,
    font,
    fontSize,
    complexScriptFontSize,
  }) {
    this.zip = zip;
    this.htmlString = htmlString;
    this.orientation = orientation;
    this.width = orientation === 'landscape' ? 15840 : 12240;
    this.height = orientation === 'landscape' ? 12240 : 15840;
    this.margins =
      // eslint-disable-next-line no-nested-ternary
      margins && Object.keys(margins).length
        ? margins
        : orientation === 'landscape'
        ? landscapeMargins
        : portraitMargins;
    this.availableDocumentSpace = this.width - this.margins.left - this.margins.right;
    this.title = title || '';
    this.subject = subject || '';
    this.creator = creator || 'html-to-docx';
    this.keywords = keywords || ['html-to-docx'];
    this.description = description || '';
    this.lastModifiedBy = lastModifiedBy || 'html-to-docx';
    this.revision = revision || 1;
    this.createdAt = createdAt || new Date();
    this.modifiedAt = modifiedAt || new Date();
    this.headerType = headerType || 'default';
    this.header = header || false;
    this.font = font || 'Times New Roman';
    this.fontSize = fontSize || 22;
    this.complexScriptFontSize = complexScriptFontSize || 22;

    this.lastNumberingId = 0;
    this.lastDocumentRelsId = 4;
    this.lastMediaId = 0;
    this.lastHeaderId = 0;
    this.stylesObjects = [];
    this.numberingObjects = [];
    this.documentRelsObjects = [];
    this.mediaFiles = [];
    this.headerObjects = [];
    this.documentXML = null;

    this.generateContentTypesXML = this.generateContentTypesXML.bind(this);
    this.generateCoreXML = this.generateCoreXML.bind(this);
    this.generateDocumentXML = this.generateDocumentXML.bind(this);
    this.generateSettingsXML = this.generateSettingsXML.bind(this);
    this.generateWebSettingsXML = this.generateWebSettingsXML.bind(this);
    this.generateStylesXML = this.generateStylesXML.bind(this);
    this.generateFontTableXML = this.generateFontTableXML.bind(this);
    this.generateNumberingXML = this.generateNumberingXML.bind(this);
    this.generateDocumentRelsXML = this.generateDocumentRelsXML.bind(this);
    this.createMediaFile = this.createMediaFile.bind(this);
    this.createDocumentRelationships = this.createDocumentRelationships.bind(this);
    this.generateHeaderXML = this.generateHeaderXML.bind(this);
  }

  generateContentTypesXML() {
    const contentTypesXML = create({ encoding: 'UTF-8', standalone: true }, contentTypesXMLString);

    if (this.headerObjects && Array.isArray(this.headerObjects) && this.headerObjects.length) {
      this.headerObjects.forEach(
        // eslint-disable-next-line array-callback-return
        ({ headerId }) => {
          const contentTypesFragment = fragment({
            defaultNamespace: {
              ele: 'http://schemas.openxmlformats.org/package/2006/content-types',
            },
          })
            .ele('Override')
            .att('PartName', `/word/header${headerId}.xml`)
            .att(
              'ContentType',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'
            )
            .up();
          contentTypesXML.root().import(contentTypesFragment);
        }
      );
    }

    return contentTypesXML.toString({ prettyPrint: true });
  }

  generateCoreXML() {
    const coreXML = create(
      { encoding: 'UTF-8', standalone: true },
      generateCoreXML(
        this.title,
        this.subject,
        this.creator,
        this.keywords,
        this.description,
        this.lastModifiedBy,
        this.revision,
        this.createdAt,
        this.modifiedAt
      )
    );

    return coreXML.toString({ prettyPrint: true });
  }

  generateDocumentXML() {
    const documentXML = create(
      { encoding: 'UTF-8', standalone: true },
      generateDocumentTemplate(this.width, this.height, this.orientation, this.margins)
    );
    documentXML.root().first().import(this.documentXML);

    if (
      this.header &&
      this.headerObjects &&
      Array.isArray(this.headerObjects) &&
      this.headerObjects.length
    ) {
      const headerXmlFragment = fragment();

      this.headerObjects.forEach(
        // eslint-disable-next-line array-callback-return
        ({ relationshipId, type }) => {
          const headerFragment = fragment({
            namespaceAlias: {
              w: namespaces.w,
              r: namespaces.r,
            },
          })
            .ele('@w', 'headerReference')
            .att('@r', 'id', `rId${relationshipId}`)
            .att('@w', 'type', type)
            .up();
          headerXmlFragment.import(headerFragment);
        }
      );

      documentXML.root().first().first().import(headerXmlFragment);
    }

    return documentXML.toString({ prettyPrint: true });
  }

  // eslint-disable-next-line class-methods-use-this
  generateSettingsXML() {
    const settingsXML = create({ encoding: 'UTF-8', standalone: true }, settingsXMLString);

    return settingsXML.toString({ prettyPrint: true });
  }

  // eslint-disable-next-line class-methods-use-this
  generateWebSettingsXML() {
    const webSettingsXML = create({ encoding: 'UTF-8', standalone: true }, webSettingsXMLString);

    return webSettingsXML.toString({ prettyPrint: true });
  }

  // eslint-disable-next-line class-methods-use-this
  generateStylesXML() {
    const stylesXML = create(
      { encoding: 'UTF-8', standalone: true },
      generateStylesXML(this.font, this.fontSize, this.complexScriptFontSize)
    );

    return stylesXML.toString({ prettyPrint: true });
  }

  // eslint-disable-next-line class-methods-use-this
  generateFontTableXML() {
    const fontTableXML = create({ encoding: 'UTF-8', standalone: true }, fontTableXMLString);

    return fontTableXML.toString({ prettyPrint: true });
  }

  generateNumberingXML() {
    const numberingXML = create(
      { encoding: 'UTF-8', standalone: true },
      generateNumberingXMLTemplate()
    );

    const abstractNumberingFragments = fragment();
    const numberingFragments = fragment();

    this.numberingObjects.forEach(
      // eslint-disable-next-line array-callback-return
      ({ numberingId, listElements }) => {
        const abstractNumberingFragment = fragment({
          namespaceAlias: { w: namespaces.w },
        })
          .ele('@w', 'abstractNum')
          .att('@w', 'abstractNumId', String(numberingId))
          .ele('@w', 'multiLevelType')
          .att('@w', 'val', 'hybridMultilevel')
          .up();

        listElements
          .filter((value, index, self) => {
            return self.findIndex((v) => v.level === value.level) === index;
          })
          .forEach(({ level, type }) => {
            const levelFragment = fragment({
              namespaceAlias: { w: namespaces.w },
            })
              .ele('@w', 'lvl')
              .att('@w', 'ilvl', level)
              .ele('@w', 'start')
              .att('@w', 'val', '1')
              .up()
              .ele('@w', 'numFmt')
              .att('@w', 'val', type === 'ol' ? 'decimal' : 'bullet')
              .up()
              .ele('@w', 'lvlText')
              .att('@w', 'val', type === 'ol' ? `%${level + 1}` : '')
              .up()
              .ele('@w', 'lvlJc')
              .att('@w', 'val', 'left')
              .up()
              .ele('@w', 'pPr')
              .ele('@w', 'tabs')
              .ele('@w', 'tab')
              .att('@w', 'val', 'num')
              .att('@w', 'pos', (level + 1) * 720)
              .up()
              .up()
              .ele('@w', 'ind')
              .att('@w', 'left', (level + 1) * 720)
              .att('@w', 'hanging', 360)
              .up()
              .up()
              .up();

            if (type === 'ul') {
              const runPropertiesFragment = fragment({
                namespaceAlias: { w: namespaces.w },
              })
                .ele('@w', 'rPr')
                .ele('@w', 'rFonts')
                .att('@w', 'ascii', 'Wingdings')
                .att('@w', 'hAnsi', 'Wingdings')
                .att('@w', 'hint', 'default')
                .up()
                .up();

              levelFragment.last().import(runPropertiesFragment);
            }

            abstractNumberingFragment.import(levelFragment);
          });

        abstractNumberingFragment.up();

        const numberingFragment = fragment({
          namespaceAlias: { w: namespaces.w },
        })
          .ele('@w', 'num')
          .att('@w', 'numId', String(numberingId))
          .ele('@w', 'abstractNumId')
          .att('@w', 'val', String(numberingId))
          .up()
          .up();

        abstractNumberingFragments.import(abstractNumberingFragment);
        numberingFragments.import(numberingFragment);
      }
    );

    numberingXML.root().import(abstractNumberingFragments);
    numberingXML.root().import(numberingFragments);

    return numberingXML.toString({ prettyPrint: true });
  }

  generateDocumentRelsXML() {
    const documentRelsXML = create({ encoding: 'UTF-8', standalone: true }, documentRelsXMLString);

    this.documentRelsObjects.forEach(
      // eslint-disable-next-line array-callback-return
      ({ relationshipId, type, target, targetMode }) => {
        const relationshipFragment = fragment({
          defaultNamespace: { ele: 'http://schemas.openxmlformats.org/package/2006/relationships' },
        })
          .ele('Relationship')
          .att('Id', `rId${relationshipId}`)
          .att('Type', type)
          .att('Target', target)
          .att('TargetMode', targetMode)
          .up();
        documentRelsXML.root().import(relationshipFragment);
      }
    );

    return documentRelsXML.toString({ prettyPrint: true });
  }

  createNumbering(listElements) {
    this.lastNumberingId += 1;
    this.numberingObjects.push({ numberingId: this.lastNumberingId, listElements });

    return this.lastNumberingId;
  }

  createMediaFile(base64String) {
    // eslint-disable-next-line no-useless-escape
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches.length !== 3) {
      throw new Error('Invalid base64 string');
    }

    const base64FileContent = matches[2];
    // matches array contains file type in base64 format - image/jpeg and base64 stringified data
    const fileExtension =
      matches[1].match(/\/(.*?)$/)[1] === 'octet-stream' ? 'png' : matches[1].match(/\/(.*?)$/)[1];
    const SHA1String = crypto.createHash('sha1').update(crypto.randomBytes(20)).digest('hex');

    const fileNameWithExtension = `image-${SHA1String}.${fileExtension}`;

    this.lastMediaId += 1;

    return { id: this.lastMediaId, fileContent: base64FileContent, fileNameWithExtension };
  }

  createDocumentRelationships(type, target, targetMode = 'External') {
    this.lastDocumentRelsId += 1;
    let relationshipType;
    switch (type) {
      case 'hyperlink':
        relationshipType = namespaces.hyperlinks;
        break;
      case 'image':
        relationshipType = namespaces.images;
        break;
      case 'header':
        relationshipType = namespaces.headers;
        break;
      default:
        break;
    }

    this.documentRelsObjects.push({
      relationshipId: this.lastDocumentRelsId,
      type: relationshipType,
      target,
      targetMode,
    });

    return this.lastDocumentRelsId;
  }

  generateHeaderXML(vTree) {
    const headerXML = create({
      encoding: 'UTF-8',
      standalone: true,
      namespaceAlias: {
        w: namespaces.w,
        ve: namespaces.ve,
        o: namespaces.o,
        r: namespaces.r,
        v: namespaces.v,
        wp: namespaces.wp,
        w10: namespaces.w10,
      },
    }).ele('@w', 'hdr');

    const XMLFragment = fragment();
    convertVTreeToXML(this, vTree, XMLFragment);
    headerXML.root().import(XMLFragment);

    this.lastHeaderId += 1;

    return { headerId: this.lastHeaderId, headerXML };
  }
}

export default DocxDocument;
