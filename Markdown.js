const reconvertUnicode = require('./utils');
const Gist = require('./Gist');

class Markdown {
  constructor($) {
    this.$ = $;
  }

  getArticleTitle() {
    return this.$('meta[property="og:title"]').first().attr('content');
  }

  getArticleDate() {
    let result = '';
    const month = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'};
    const isThisYear = (dateArray) => dateArray.length === 2;
    const date = this.$('div .ew a[rel="noopener"]').eq(2).text();
    const dateArray = date.split(' ');
    if (isThisYear(dateArray)) {
      const now = new Date();
      result = `${now.getFullYear()}-${month[dateArray[0]]}-${dateArray[1]}`;
    } else {
      result = `${dateArray[0]}-${month[dateArray[1]]}-${dateArray[2]}`;
    }
    return `${result} 00:00:00`;
  }

  getArticleTags() {
    const isTag = (targetDom) => {
      const href = targetDom.attr('href');
      return href && href.indexOf('tag') !== -1;
    };
    let result = '';
    const tags = this.$('ul li a');
    const tagKeys = Object.keys(tags);
    tagKeys.forEach((key) => {
      const targetDom = tags.eq(key);
      if (isTag(targetDom)) {
        result += `\n- ${targetDom.text()}`;
      }
    });
    return result;
  }

  getArticleHeader() {
    let result = '---\n';
    result += `title: ${this.getArticleTitle()}\n`;
    result += `date: ${this.getArticleDate()}\n`;
    result += `tags: ${this.getArticleTags()}\n`;
    result += '---\n\n';
    return result;
  }

  parseIframe(iframeDom) {
    const iframeSrc = this.$(iframeDom).find('iframe').attr('src');
    const parseProcess = new Gist(iframeSrc);
    return parseProcess.getMarkdown();
  }

  parseMedium(mediumDOM) {
    const isImage = content => content.indexOf('noscript') !== -1;
    const isIframe = content => content.indexOf('iframe') !== -1;
    const handleImage = (content) => {
      const removeWidthAndHeight = image => this.$(image).removeAttr('height').removeAttr('width');
      const image = this.$(content).find('noscript').html();
      return `${removeWidthAndHeight(image)}\n\n`;
    }
    const domContent = reconvertUnicode(this.$(mediumDOM).html());
    return new Promise((resolve) => {
      switch(mediumDOM.name) {
        case 'h1':
          resolve(`## ${domContent}`);
          break;
        case 'h2':
          resolve(`### ${domContent}`);
          break;
        case 'p':
          resolve(`${domContent}`);
          break;
        case 'pre':
          resolve(`<pre>${domContent}</pre>`);
          break;
        case 'ol':
          resolve(`<ol>\n${domContent}\n</ol>`);
          break;
        case 'blockquote':
          const blockquoteStyle = 'font-size: 26px; color: #696969; font-style:italic';
          resolve(`<span style="${blockquoteStyle}">${this.$(domContent).text()}</span>`);
          break;
        case 'div':
          resolve(handleImage(mediumDOM));
          break;
        case 'figure': // 有圖片和 iframe 兩種
          if (isImage(domContent)) {
            resolve(handleImage(mediumDOM));
            break;
          }
          if (isIframe(domContent)) {
            resolve(
              new Promise((resolve) => {
                resolve(this.parseIframe(mediumDOM));
              })
            );
            break;
          }
        default:
          resolve('');
      }
    })
  }

  parseParagraph(that, paragraph, paragraphIndex) {
    const isNotArticleContent = index => index === 1;
    const getParagraphContent = section => this.$('div div', section).eq(0);
    if (paragraph.name === 'section') {
      if (isNotArticleContent(paragraphIndex)) {
        that.$('div', paragraph).first().remove();
      }
      const mainContent = getParagraphContent(paragraph);
      const parseMediumPromiseArray = [];
      that.$(mainContent).children().map(
        function() { parseMediumPromiseArray.push(that.parseMedium(this)); }
      );
      return new Promise((resolve) => {
        resolve(Promise.all(parseMediumPromiseArray));
      });
    } else if (paragraph.name === 'hr') {
      return new Promise((resolve) => {
        resolve('---');
      });
    }
  }

  getArticleContent(writeRes) {
    const that = this;
    const articleContent = this.$('article div').first().contents();
    const parseContentPromiseArray = [];
    articleContent.map(function (partIndex) {
      const currentParagraph = this;
      parseContentPromiseArray.push(
        that.parseParagraph(that, currentParagraph, partIndex)
      );
    });
    Promise.all(parseContentPromiseArray).then((markdownContents) => {
      let result = '';
      markdownContents.forEach((markdownContent) => {
        if(Array.isArray(markdownContent)) {
          result += markdownContent.join('\n\n');
        } else {
          result += `\n\n${markdownContent}\n\n`
        }
      })
      writeRes(result);
    });
  }
}

module.exports = Markdown;